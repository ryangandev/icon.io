import type { Server, Socket } from 'socket.io';
import type { DrawAndGuessDetailRoomInfo } from '../../models/types.js';
import {
  getDrawAndGuessLobbyRoomInfo,
  getDrawAndGuessRoomState,
  getRoomStatus,
} from '../../libs/utils.js';
import { asRoomError, type CustomError } from '../../models/error.js';
import type { PlayerSessionRegistry } from '../../libs/player-session.js';
import type { RoomMembership } from './membership.js';
import {
  joinRoomRequest,
  leaveRoomRequest,
  parseArgs,
  roomIdOnly,
} from '../../libs/validation.js';

const roomEventsHandler = (
  io: Server,
  socket: Socket,
  drawAndGuessDetailRoomInfoList: Record<string, DrawAndGuessDetailRoomInfo>,
  sessions: PlayerSessionRegistry,
  membership: RoomMembership,
) => {
  socket.on('clientJoinDrawAndGuessRoomRequest', (...rawArgs: unknown[]) => {
    const validated = parseArgs(
      joinRoomRequest,
      // The password is optional on the wire for unlocked rooms.
      [rawArgs[0], rawArgs[1], rawArgs[2] ?? ''],
      'clientJoinDrawAndGuessRoomRequest',
    );
    if (!validated) return;
    const [roomId, username, password] = validated;

    // Identity comes from the connection, never from the payload: the client
    // proved who it was during the handshake, and this is the result.
    const playerId = sessions.playerIdFor(socket.id);
    if (!playerId) return;

    try {
      if (!drawAndGuessDetailRoomInfoList[roomId]) {
        const err: CustomError = new Error(
          'Room does not exist.',
        ) as CustomError;
        err.errorType = 'roomNotExist';
        throw err;
      }

      const currentRoom = drawAndGuessDetailRoomInfoList[roomId];
      const isAlreadySeated = Boolean(currentRoom.playerList[playerId]);

      // A player already holding a seat is returning to it, so a full room or
      // a game in progress is no reason to turn them away.
      if (!isAlreadySeated && currentRoom.status !== 'Open') {
        const err: CustomError = new Error('Room is not open.') as CustomError;
        err.errorType = 'roomNotOpen';
        throw err;
      }

      // If room has password, check if password is correct, if not, send reject event
      if (currentRoom.password && currentRoom.password !== password) {
        socket.emit('rejectClientJoinDrawAndGuessRoomRequest', {
          status: true,
          message: 'Incorrect password. Please try again.',
        });
        return;
      }

      const existing = currentRoom.playerList[playerId];
      currentRoom.playerList[playerId] = {
        username,
        // Points survive: this is the same player, on a new connection.
        points: existing?.points ?? 0,
        receivedPointsThisTurn: existing?.receivedPointsThisTurn ?? false,
        isConnected: true,
      };
      currentRoom.currentPlayerCount = Object.keys(
        currentRoom.playerList,
      ).length;
      currentRoom.status = getRoomStatus(
        currentRoom.currentPlayerCount,
        currentRoom.maxPlayers,
        currentRoom.isGameStarted,
      );

      socket.join(roomId);

      // Notify the current client that they will be joining the room
      socket.emit('approveClientJoinDrawAndGuessRoomRequest', roomId);

      // Notify all clients in the lobby that a client has joined a room
      io.emit(
        'updateDrawAndGuessLobbyRoomList',
        Object.values(drawAndGuessDetailRoomInfoList).map(
          getDrawAndGuessLobbyRoomInfo,
        ),
      );

      // These used to be delayed by 250ms "to ensure that the client has joined
      // the room". socket.join() above is synchronous on a single node, so by
      // this line the socket is already a member and the delay bought nothing.
      io.to(roomId).emit(
        'clientJoinDrawAndGuessRoomSuccess',
        getDrawAndGuessRoomState(currentRoom),
      );

      if (!isAlreadySeated) {
        io.to(roomId).emit(
          'receiveMessage',
          '📢 System',
          username + ' has joined the room.',
        );
      }
    } catch (error) {
      console.error(error);
      // Notify the current client that there was an error
      socket.emit('roomError', asRoomError(error));
    }
  });

  /**
   * Asked for by the room page once it has mounted and its listeners are live.
   * The join broadcast above races the joining client's own navigation — it
   * cannot have subscribed yet — so rather than guessing how long that takes,
   * the client says when it is ready.
   *
   * Answered only for players who hold a seat. The payload carries no secrets,
   * but a locked room's player list is not something a stranger should be able
   * to pull with a room id off the lobby broadcast. A client that arrives
   * without a seat — a pasted link — is told so, and asks to join.
   */
  socket.on('requestDrawAndGuessRoomState', (...rawArgs: unknown[]) => {
    const validated = parseArgs(
      roomIdOnly,
      rawArgs,
      'requestDrawAndGuessRoomState',
    );
    if (!validated) return;
    const [roomId] = validated;

    const currentRoom = drawAndGuessDetailRoomInfoList[roomId];
    if (!currentRoom) {
      socket.emit('roomError', {
        status: true,
        message: 'Room does not exist.',
        errorType: 'roomNotExist',
      });
      return;
    }

    const playerId = sessions.playerIdFor(socket.id);
    if (!playerId || !currentRoom.playerList[playerId]) {
      socket.emit('roomError', {
        status: true,
        message: 'You are not in this room.',
        errorType: 'notRoomMember',
      });
      return;
    }

    socket.emit(
      'clientJoinDrawAndGuessRoomSuccess',
      getDrawAndGuessRoomState(currentRoom),
    );

    // Whatever has been drawn so far, to this socket alone. A joiner, a player
    // returning from a reload and a drawer resuming their own turn all arrive
    // through here, and all three used to find a blank board.
    socket.emit('syncWhiteboardCanvas', currentRoom.canvas.strokes);

    // The word is drawer-private, so the snapshot omits it while it is in
    // play. A drawer who reloads lost their copy of it along with the page,
    // and cannot draw a word they can no longer see — so send it again, to
    // them alone, at the one moment their listeners are known to be live.
    if (currentRoom.currentDrawer === playerId) {
      if (currentRoom.isWordSelectingPhase) {
        socket.emit('drawerReceiveWordChoices', currentRoom.wordChoices);
      } else if (currentRoom.isDrawingPhase) {
        socket.emit('drawingPhaseStartedForDrawer', currentRoom.currentWord);
      }
    }
  });

  socket.on('clientLeaveDrawAndGuessRoom', (...rawArgs: unknown[]) => {
    const validated = parseArgs(
      leaveRoomRequest,
      rawArgs,
      'clientLeaveDrawAndGuessRoom',
    );
    if (!validated) return;
    const [roomId, username] = validated;

    const playerId = sessions.playerIdFor(socket.id);
    if (!playerId) return;

    // Leaving is deliberate, so the seat goes at once — no grace period. A
    // stray or repeated leave is ignored inside `leave`, before any mutation.
    membership.leave(roomId, playerId, username);
  });
};

export { roomEventsHandler };
