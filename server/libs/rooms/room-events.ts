import { asFailure, failure, invalidRequest } from '../../models/error.js';
import { roomStatus } from './seats.js';
import { joinRoomRequest, parseArgs, roomIdOnly } from '../validation.js';
import type { RoomMembership } from './membership.js';
import type { RoomRegistry } from './registry.js';
import {
  emitToSocket,
  onClientEvent,
  onClientRequest,
  type IoSocket,
} from './emit.js';

/**
 * Joining, leaving, re-syncing and starting: the four things every room does
 * regardless of what is played in it.
 *
 * Each request is answered through its acknowledgement, success or the reason
 * it was refused, and anything it changes reaches the room as a new snapshot.
 */
const roomEventsHandler = (
  socket: IoSocket,
  registry: RoomRegistry,
  membership: RoomMembership,
) => {
  onClientRequest(socket, 'room:join', (args, reply) => {
    const validated = parseArgs(
      joinRoomRequest,
      // Tolerate a missing password: an unlocked room has none to send.
      [args[0], args[1], args[2] ?? ''],
      'room:join',
    );
    if (!validated) {
      reply(invalidRequest());
      return;
    }
    const [roomId, username, password] = validated;

    // Identity comes from the connection, never from the payload: the client
    // proved who it was during the handshake, and this is the result.
    const playerId = socket.data.playerId;

    const room = registry.lookup.get(roomId);
    if (!room || !registry.moduleOf(room)) {
      reply(failure('roomNotExist', 'Room does not exist.'));
      return;
    }

    const isAlreadySeated = Boolean(room.playerList[playerId]);

    if (!isAlreadySeated) {
      // A player already holding a seat is returning to it, so a full room or
      // a game in progress is no reason to turn them away, and the seat they
      // hold is all the proof a locked room asks for.
      if (roomStatus(room) !== 'Open') {
        reply(failure('roomNotOpen', 'Room is not open.'));
        return;
      }
      if (room.password && room.password !== password) {
        reply(
          failure('incorrectPassword', 'Incorrect password. Please try again.'),
        );
        return;
      }

      membership.leaveAllBut(playerId, roomId);
      room.playerList[playerId] = { username, points: 0, isConnected: true };
    }
    // A seat already held keeps the name it was taken with: standings,
    // ownership and the chat all know the player by it.

    socket.join(roomId);
    reply({ ok: true });

    if (!isAlreadySeated) {
      registry.lookup.announce(
        roomId,
        'system',
        `${username} has joined the room.`,
      );
    }
    registry.lookup.emitState(room);
    registry.lookup.emitLobby(room.gameType);
  });

  /**
   * Asked for by the room page once it has mounted and its listeners are live.
   * A snapshot broadcast while the page was still navigating would have
   * nowhere to land, so rather than guessing how long that takes, the client
   * says when it is ready.
   *
   * Answered only for players who hold a seat. A locked room's player list is
   * not something a stranger should be able to pull with a room id off the
   * lobby broadcast. A client that arrives without a seat (a pasted link) is
   * told so, and asks to join.
   */
  onClientRequest(socket, 'room:sync', (args, reply) => {
    const validated = parseArgs(roomIdOnly, args, 'room:sync');
    if (!validated) {
      reply(invalidRequest());
      return;
    }
    const [roomId] = validated;

    const room = registry.lookup.get(roomId);
    const module = room ? registry.moduleOf(room) : undefined;
    if (!room || !module) {
      reply(failure('roomNotExist', 'Room does not exist.'));
      return;
    }

    const playerId = socket.data.playerId;
    if (!room.playerList[playerId]) {
      reply(failure('notRoomMember', 'You are not in this room.'));
      return;
    }

    // Normally already in the channel, from creating, joining or resuming;
    // joining again costs nothing and makes sure.
    socket.join(roomId);
    reply({ ok: true });

    emitToSocket(socket, 'room:state', module.toRoomState(room, playerId));
    emitToSocket(socket, 'chat:history', roomId, [...room.chat.messages]);

    // Whatever else this one socket needs and the snapshot cannot carry, such
    // as a drawing. A joiner, a player returning from a reload and a drawer
    // resuming their own turn all arrive through here.
    module.syncTo(socket, room, playerId);
  });

  onClientEvent(socket, 'room:leave', (...rawArgs: unknown[]) => {
    const validated = parseArgs(roomIdOnly, rawArgs, 'room:leave');
    if (!validated) return;
    const [roomId] = validated;

    const playerId = socket.data.playerId;

    // Leaving is deliberate, so the seat goes at once, with no grace period.
    // A stray or repeated leave is ignored inside `leave`, before any change.
    membership.leave(roomId, playerId);
  });

  onClientRequest(socket, 'game:start', (args, reply) => {
    const validated = parseArgs(roomIdOnly, args, 'game:start');
    if (!validated) {
      reply(invalidRequest());
      return;
    }
    const [roomId] = validated;

    const playerId = socket.data.playerId;

    const room = registry.lookup.get(roomId);
    const module = room ? registry.moduleOf(room) : undefined;
    if (!room || !module) {
      reply(failure('roomNotExist', 'Room does not exist.'));
      return;
    }

    try {
      module.startGame(room, playerId);
    } catch (error) {
      reply(asFailure(error));
      return;
    }
    reply({ ok: true });
  });
};

export { roomEventsHandler };
