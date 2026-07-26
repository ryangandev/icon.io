import type { Server } from 'socket.io';
import type {
  DrawAndGuessDetailRoomInfo,
  OwnerInfo,
} from '../../models/types.js';
import {
  getDrawAndGuessLobbyRoomInfo,
  getDrawAndGuessRoomState,
  getRoomStatus,
} from '../../libs/utils.js';
import { reconnectGraceInSeconds } from '../../libs/game-clock.js';
import type { PlayerSessionRegistry } from '../../libs/player-session.js';
import type { DrawAndGuessGameEngine } from './game-engine.js';

const SYSTEM = '📢 System';

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
 */
const createRoomMembership = (
  io: Server,
  rooms: Record<string, DrawAndGuessDetailRoomInfo>,
  sessions: PlayerSessionRegistry,
  gameEngine: DrawAndGuessGameEngine,
  graceInSeconds: number = reconnectGraceInSeconds,
) => {
  /** Pending seat expiries, keyed `roomId:playerId`. */
  const graceTimers = new Map<string, NodeJS.Timeout>();

  const graceKey = (roomId: string, playerId: string) =>
    `${roomId}:${playerId}`;

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
        if (roomsHeldBy(playerId).length > 0) return;
        sessions.forget(playerId);
      }, graceInSeconds * 1000),
    );
  };

  const announce = (roomId: string, message: string) => {
    io.to(roomId).emit('receiveMessage', SYSTEM, message);
  };

  const emitLobby = () => {
    io.emit(
      'updateDrawAndGuessLobbyRoomList',
      Object.values(rooms).map(getDrawAndGuessLobbyRoomInfo),
    );
  };

  const recount = (room: DrawAndGuessDetailRoomInfo) => {
    room.currentPlayerCount = Object.keys(room.playerList).length;
    room.status = getRoomStatus(
      room.currentPlayerCount,
      room.maxPlayers,
      room.isGameStarted,
    );
  };

  /** Rooms this player holds a seat in, connected or not. */
  const roomsHeldBy = (playerId: string): DrawAndGuessDetailRoomInfo[] =>
    Object.values(rooms).filter((room) => room.playerList[playerId]);

  /**
   * Removes the seat for good and lets the engine deal with a stranded turn.
   * Shared by an explicit leave and by a grace period running out.
   */
  const releaseSeat = (
    room: DrawAndGuessDetailRoomInfo,
    playerId: string,
    username: string,
  ) => {
    const roomId = room.roomId;
    const wasOwner = room.owner.playerId === playerId;

    delete room.playerList[playerId];
    recount(room);

    if (room.currentPlayerCount === 0) {
      gameEngine.disposeRoom(roomId);
      delete rooms[roomId];
      emitLobby();
      return;
    }

    if (wasOwner) {
      const nextOwnerId = Object.keys(room.playerList)[0];
      const nextOwner: OwnerInfo = {
        username: room.playerList[nextOwnerId].username,
        playerId: nextOwnerId,
      };
      room.owner = nextOwner;
      announce(
        roomId,
        `Previous owner ${username} has left the room. ${nextOwner.username} is now the owner.`,
      );
    } else {
      announce(roomId, `${username} has left the room.`);
    }

    io.to(roomId).emit(
      'clientLeaveDrawAndGuessRoomSuccess',
      getDrawAndGuessRoomState(room),
    );

    // A departure can strand a turn — the drawer may have been the one who
    // left, or the room may have dropped below two players.
    gameEngine.handlePlayerDeparture(room, playerId);

    // Built after the departure is handled, so an ended game shows as 'Open'
    // rather than a stale 'In Progress'.
    emitLobby();
  };

  /** Somebody clicked Leave. No grace: they meant it. */
  const leave = (roomId: string, playerId: string, username: string) => {
    const room = rooms[roomId];
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

    const held = roomsHeldBy(playerId);
    if (held.length === 0) {
      // Not in a room, so there is no seat to hold — but the identity still
      // outlives the connection for the same grace period. Forgetting it here
      // would mean a reload from the lobby came back as a stranger, and would
      // race a reconnection that has already landed.
      scheduleSessionExpiry(playerId);
      return;
    }

    for (const room of held) {
      const player = room.playerList[playerId];
      player.isConnected = false;

      io.to(room.roomId).emit(
        'clientLeaveDrawAndGuessRoomSuccess',
        getDrawAndGuessRoomState(room),
      );
      announce(room.roomId, `${player.username} lost connection.`);

      // The seat waits for them; the turn does not.
      gameEngine.skipTurnOfAbsentDrawer(room, playerId);

      const key = graceKey(room.roomId, playerId);
      graceTimers.set(
        key,
        setTimeout(() => {
          graceTimers.delete(key);

          // The room may be gone, and the player may have come back or left
          // properly, in the time we spent waiting.
          const current = rooms[room.roomId];
          const seat = current?.playerList[playerId];
          if (!seat || seat.isConnected) return;

          releaseSeat(current, playerId, seat.username);
          scheduleSessionExpiry(playerId);
        }, graceInSeconds * 1000),
      );
    }

    emitLobby();
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

    for (const room of roomsHeldBy(playerId)) {
      cancelGrace(room.roomId, playerId);

      const player = room.playerList[playerId];
      player.isConnected = true;
      socket?.join(room.roomId);

      io.to(room.roomId).emit(
        'clientJoinDrawAndGuessRoomSuccess',
        getDrawAndGuessRoomState(room),
      );
      announce(room.roomId, `${player.username} reconnected.`);
    }

    emitLobby();
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
