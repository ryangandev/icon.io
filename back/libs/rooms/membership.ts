import type { Server } from 'socket.io';
import type { OwnerInfo } from '../../../shared/wire-types.js';
import { getRoomStatus } from '../utils.js';
import { reconnectGraceInSeconds } from '../game-clock.js';
import type { PlayerSessionRegistry } from '../player-session.js';
import type { RoomRegistry } from './registry.js';
import type { Room } from './types.js';
import { emitToRoom } from './emit.js';

/** Pending seat expiries are keyed by the pair, not by either half. */
const graceKey = (roomId: string, playerId: string) => `${roomId}:${playerId}`;

const recount = (room: Room) => {
  room.currentPlayerCount = Object.keys(room.playerList).length;
  room.status = getRoomStatus(
    room.currentPlayerCount,
    room.maxPlayers,
    room.isGameStarted,
  );
};

/**
 * Who is in a room, and for how long after they stop answering.
 *
 * The leave handler and the disconnect handler used to carry near-identical
 * copies of the departure logic — recount, transfer ownership, delete the room
 * if empty, tell the engine — which is how they came to disagree about whether
 * to check membership first. They are one code path now, with one difference
 * that matters:
 *
 * - **Leaving is deliberate.** The seat goes immediately.
 * - **Disconnecting might not be.** A reload takes about a second and looks
 *   exactly like leaving forever. The seat, the score and the place in the
 *   round are held for `reconnectGraceInSeconds` in case the player comes back.
 *
 * None of that has anything to do with what is being played, which is why this
 * moved out of `socket/draw-and-guess/` unchanged in behaviour. What used to be
 * three direct calls into the Draw & Guess engine — a stranded turn, a drawer
 * who dropped, a drawer who came back — are three calls on whatever module owns
 * the room.
 */
const createRoomMembership = (
  io: Server,
  registry: RoomRegistry,
  sessions: PlayerSessionRegistry,
  graceInSeconds: number = reconnectGraceInSeconds,
) => {
  /** Pending seat expiries, keyed `roomId:playerId`. */
  const graceTimers = new Map<string, NodeJS.Timeout>();

  const cancelGrace = (roomId: string, playerId: string) => {
    const key = graceKey(roomId, playerId);
    const pending = graceTimers.get(key);
    if (pending) {
      clearTimeout(pending);
      graceTimers.delete(key);
    }
  };

  /**
   * Forgets an identity once nobody could still be using it, so the registry
   * does not grow for the lifetime of the process.
   */
  const scheduleSessionExpiry = (playerId: string) => {
    const key = graceKey('session', playerId);
    cancelGrace('session', playerId);

    graceTimers.set(
      key,
      setTimeout(() => {
        graceTimers.delete(key);
        if (sessions.isOnline(playerId)) return;
        if (registry.roomsHeldBy(playerId).length > 0) return;
        sessions.forget(playerId);
      }, graceInSeconds * 1000),
    );
  };

  /** The room snapshot, built by whichever game the room belongs to. */
  const emitRoomState = (room: Room) => {
    const module = registry.moduleOf(room);
    if (!module) return;
    emitToRoom(io, room.roomId, 'room:state', module.toRoomState(room));
  };

  /**
   * Removes the seat for good and lets the game deal with a stranded turn.
   * Shared by an explicit leave and by a grace period running out.
   */
  const releaseSeat = (room: Room, playerId: string, username: string) => {
    const roomId = room.roomId;
    const gameType = room.gameType;
    const module = registry.moduleOf(room);
    const wasOwner = room.owner.playerId === playerId;

    delete room.playerList[playerId];
    recount(room);

    if (room.currentPlayerCount === 0) {
      module?.disposeRoom(roomId);
      delete registry.all[roomId];
      registry.lookup.emitLobby(gameType);
      return;
    }

    if (wasOwner) {
      const nextOwnerId = Object.keys(room.playerList)[0];
      const nextOwner: OwnerInfo = {
        username: room.playerList[nextOwnerId].username,
        playerId: nextOwnerId,
      };
      room.owner = nextOwner;
      registry.lookup.announce(
        roomId,
        `Previous owner ${username} has left the room. ${nextOwner.username} is now the owner.`,
      );
    } else {
      registry.lookup.announce(roomId, `${username} has left the room.`);
    }

    emitRoomState(room);

    // A departure can strand a turn — the player may have been the one whose
    // move the room was waiting on, or the room may have dropped below the
    // game's minimum.
    module?.onDeparture(room, playerId);

    // Built after the departure is handled, so an ended game shows as 'Open'
    // rather than a stale 'In Progress'.
    registry.lookup.emitLobby(gameType);
  };

  /** Somebody clicked Leave. No grace: they meant it. */
  const leave = (roomId: string, playerId: string, username: string) => {
    const room = registry.lookup.get(roomId);
    if (!room) return;
    // Leaving a room you were never in used to run the whole departure anyway.
    if (!room.playerList[playerId]) return;

    cancelGrace(roomId, playerId);

    const socketId = sessions.socketIdFor(playerId);
    if (socketId) io.sockets.sockets.get(socketId)?.leave(roomId);

    releaseSeat(room, playerId, username);
    scheduleSessionExpiry(playerId);
  };

  /**
   * A connection dropped. The player keeps their seat, marked away, until
   * either they come back or the grace period expires.
   */
  const handleDisconnect = (socketId: string) => {
    const playerId = sessions.detach(socketId);
    if (!playerId) return;

    const held = registry.roomsHeldBy(playerId);
    if (held.length === 0) {
      // Not in a room, so there is no seat to hold — but the identity still
      // outlives the connection for the same grace period. Forgetting it here
      // would mean a reload from the lobby came back as a stranger, and would
      // race a reconnection that has already landed.
      scheduleSessionExpiry(playerId);
      return;
    }

    const touchedGames = new Set(held.map((room) => room.gameType));

    for (const room of held) {
      const player = room.playerList[playerId];
      player.isConnected = false;

      emitRoomState(room);
      registry.lookup.announce(
        room.roomId,
        `${player.username} lost connection.`,
      );

      // The seat waits for them. So, briefly, may their turn — that decision
      // belongs to the game, which is the only thing that knows whether there
      // is anything worth coming back to.
      registry.moduleOf(room)?.onDisconnect(room, playerId);

      const key = graceKey(room.roomId, playerId);
      graceTimers.set(
        key,
        setTimeout(() => {
          graceTimers.delete(key);

          // The room may be gone, and the player may have come back or left
          // properly, in the time we spent waiting.
          const current = registry.lookup.get(room.roomId);
          const seat = current?.playerList[playerId];
          if (!current || !seat || seat.isConnected) return;

          releaseSeat(current, playerId, seat.username);
          scheduleSessionExpiry(playerId);
        }, graceInSeconds * 1000),
      );
    }

    for (const gameType of touchedGames) registry.lookup.emitLobby(gameType);
  };

  /**
   * A player proved they are who they were. Any seat still being held for them
   * becomes theirs again — score, ownership and place in the round intact.
   */
  const handleResume = (playerId: string) => {
    cancelGrace('session', playerId);

    const socketId = sessions.socketIdFor(playerId);
    if (!socketId) return;
    const socket = io.sockets.sockets.get(socketId);

    const held = registry.roomsHeldBy(playerId);
    const touchedGames = new Set(held.map((room) => room.gameType));

    for (const room of held) {
      cancelGrace(room.roomId, playerId);

      const player = room.playerList[playerId];
      player.isConnected = true;
      socket?.join(room.roomId);

      emitRoomState(room);
      registry.lookup.announce(room.roomId, `${player.username} reconnected.`);

      // If the room was holding a turn open for them, it can stop.
      registry.moduleOf(room)?.onReturn(room, playerId);
    }

    for (const gameType of touchedGames) registry.lookup.emitLobby(gameType);
  };

  /** Clears every pending timer, so a closing server does not stay alive. */
  const dispose = () => {
    for (const timer of graceTimers.values()) clearTimeout(timer);
    graceTimers.clear();
  };

  return {
    leave,
    handleDisconnect,
    handleResume,
    dispose,
    /** Exposed for assertions; a seat is held iff a timer is pending. */
    isHoldingSeat: (roomId: string, playerId: string) =>
      graceTimers.has(graceKey(roomId, playerId)),
  };
};

type RoomMembership = ReturnType<typeof createRoomMembership>;

export { createRoomMembership };
export type { RoomMembership };
