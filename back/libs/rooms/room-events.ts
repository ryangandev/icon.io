import type { Server, Socket } from 'socket.io';
import { asRoomError, type CustomError } from '../../models/error.js';
import { getRoomStatus } from '../utils.js';
import {
  joinRoomRequest,
  leaveRoomRequest,
  parseArgs,
  roomIdOnly,
} from '../validation.js';
import type { PlayerSessionRegistry } from '../player-session.js';
import type { RoomMembership } from './membership.js';
import type { RoomRegistry } from './registry.js';
import { emitToRoom, emitToSocket, onClientEvent } from './emit.js';

const roomError = (message: string, errorType: string): CustomError => {
  const error = new Error(message) as CustomError;
  error.errorType = errorType as CustomError['errorType'];
  return error;
};

/**
 * Joining, leaving, re-syncing and starting — the four things every room does
 * regardless of what is played in it.
 *
 * Two of these carry a hand-off to the game and nothing more: `room:sync` sends
 * the module's snapshot and then lets it send whatever else one arriving socket
 * needs, and `game:start` is the module's own check plus the error path.
 */
const roomEventsHandler = (
  io: Server,
  socket: Socket,
  registry: RoomRegistry,
  sessions: PlayerSessionRegistry,
  membership: RoomMembership,
) => {
  onClientEvent(socket, 'room:join', (...rawArgs: unknown[]) => {
    const validated = parseArgs(
      joinRoomRequest,
      // The password is optional on the wire for unlocked rooms.
      [rawArgs[0], rawArgs[1], rawArgs[2] ?? ''],
      'room:join',
    );
    if (!validated) return;
    const [roomId, username, password] = validated;

    // Identity comes from the connection, never from the payload: the client
    // proved who it was during the handshake, and this is the result.
    const playerId = sessions.playerIdFor(socket.id);
    if (!playerId) return;

    try {
      const room = registry.lookup.get(roomId);
      if (!room) throw roomError('Room does not exist.', 'roomNotExist');

      const module = registry.moduleOf(room);
      if (!module) throw roomError('Room does not exist.', 'roomNotExist');

      const isAlreadySeated = Boolean(room.playerList[playerId]);

      // A player already holding a seat is returning to it, so a full room or
      // a game in progress is no reason to turn them away.
      if (!isAlreadySeated && room.status !== 'Open') {
        throw roomError('Room is not open.', 'roomNotOpen');
      }

      if (room.password && room.password !== password) {
        emitToSocket(socket, 'room:join:denied', {
          status: true,
          message: 'Incorrect password. Please try again.',
        });
        return;
      }

      const existing = room.playerList[playerId];
      room.playerList[playerId] = {
        username,
        // Points survive: this is the same player, on a new connection.
        points: existing?.points ?? 0,
        isConnected: true,
      };
      room.currentPlayerCount = Object.keys(room.playerList).length;
      room.status = getRoomStatus(
        room.currentPlayerCount,
        room.maxPlayers,
        room.isGameStarted,
      );

      socket.join(roomId);

      emitToSocket(socket, 'room:joined', roomId);
      registry.lookup.emitLobby(room.gameType);

      // These used to be delayed by 250ms "to ensure that the client has joined
      // the room". socket.join() above is synchronous on a single node, so by
      // this line the socket is already a member and the delay bought nothing.
      emitToRoom(io, roomId, 'room:state', module.toRoomState(room));

      if (!isAlreadySeated) {
        registry.lookup.announce(roomId, `${username} has joined the room.`);
      }
    } catch (error) {
      console.error(error);
      emitToSocket(socket, 'room:error', asRoomError(error));
    }
  });

  /**
   * Asked for by the room page once it has mounted and its listeners are live.
   * The join broadcast races the joining client's own navigation — it cannot
   * have subscribed yet — so rather than guessing how long that takes, the
   * client says when it is ready.
   *
   * Answered only for players who hold a seat. The payload carries no secrets,
   * but a locked room's player list is not something a stranger should be able
   * to pull with a room id off the lobby broadcast. A client that arrives
   * without a seat — a pasted link — is told so, and asks to join.
   */
  onClientEvent(socket, 'room:sync', (...rawArgs: unknown[]) => {
    const validated = parseArgs(roomIdOnly, rawArgs, 'room:sync');
    if (!validated) return;
    const [roomId] = validated;

    const room = registry.lookup.get(roomId);
    if (!room) {
      emitToSocket(socket, 'room:error', {
        status: true,
        message: 'Room does not exist.',
        errorType: 'roomNotExist',
      });
      return;
    }

    const playerId = sessions.playerIdFor(socket.id);
    if (!playerId || !room.playerList[playerId]) {
      emitToSocket(socket, 'room:error', {
        status: true,
        message: 'You are not in this room.',
        errorType: 'notRoomMember',
      });
      return;
    }

    const module = registry.moduleOf(room);
    if (!module) return;

    emitToSocket(socket, 'room:state', module.toRoomState(room));

    // Whatever else this one socket needs and the broadcast cannot carry: a
    // drawing, a board, a word only the drawer may see. A joiner, a player
    // returning from a reload and a drawer resuming their own turn all arrive
    // through here.
    module.syncTo(socket, room, playerId);
  });

  onClientEvent(socket, 'room:leave', (...rawArgs: unknown[]) => {
    const validated = parseArgs(leaveRoomRequest, rawArgs, 'room:leave');
    if (!validated) return;
    const [roomId, username] = validated;

    const playerId = sessions.playerIdFor(socket.id);
    if (!playerId) return;

    // Leaving is deliberate, so the seat goes at once — no grace period. A
    // stray or repeated leave is ignored inside `leave`, before any mutation.
    membership.leave(roomId, playerId, username);
  });

  onClientEvent(socket, 'game:start', (...rawArgs: unknown[]) => {
    const validated = parseArgs(roomIdOnly, rawArgs, 'game:start');
    if (!validated) return;
    const [roomId] = validated;

    const playerId = sessions.playerIdFor(socket.id);
    if (!playerId) return;

    const room = registry.lookup.get(roomId);
    if (!room) {
      emitToSocket(socket, 'room:error', {
        status: true,
        message: 'Room does not exist.',
        errorType: 'roomNotExist',
      });
      return;
    }

    try {
      registry.moduleOf(room)?.startGame(room, playerId);
    } catch (error) {
      console.log(error);
      emitToSocket(socket, 'room:error', asRoomError(error));
    }
  });
};

export { roomEventsHandler, roomError };
