import { invalidRequest } from '../../models/error.js';
import { generateRoomId, getRoomStatus } from '../utils.js';
import { parseArgs, roomCreateRequest, gameTypeOnly } from '../validation.js';
import type { RoomRegistry } from './registry.js';
import type { Room } from './types.js';
import {
  emitToSocket,
  lobbyChannel,
  onClientEvent,
  onClientRequest,
  type IoSocket,
} from './emit.js';

/**
 * Listing rooms and making one. Neither depends on what is played in them:
 * a create request is a name, a number of seats, an optional password, the
 * creator's name, and a blob only the game's own module can read.
 *
 * A lobby is a socket.io room per game (`lobby:draw-and-guess`) rather than an
 * `io.emit` to the whole server, so every Minesweeper room appearing does not
 * wake every client sitting in the Draw & Guess lobby.
 */
const lobbyEventsHandler = (socket: IoSocket, registry: RoomRegistry) => {
  onClientEvent(socket, 'lobby:subscribe', (...rawArgs: unknown[]) => {
    const validated = parseArgs(gameTypeOnly, rawArgs, 'lobby:subscribe');
    if (!validated) return;
    const [gameType] = validated;
    const module = registry.moduleFor(gameType);
    if (!module) return;

    socket.join(lobbyChannel(gameType));

    // The subscriber wants the list now, not at the next change.
    const rooms = Object.values(registry.all)
      .filter((room) => room.gameType === gameType)
      .map((room) => module.toLobbyInfo(room));

    emitToSocket(socket, 'lobby:rooms', gameType, rooms);
  });

  onClientEvent(socket, 'lobby:unsubscribe', (...rawArgs: unknown[]) => {
    const validated = parseArgs(gameTypeOnly, rawArgs, 'lobby:unsubscribe');
    if (!validated) return;
    socket.leave(lobbyChannel(validated[0]));
  });

  /**
   * A new room, with its creator already in the first seat. A room used to be
   * created empty and joined in a second request, which left a window in which
   * it sat in the lobby with nobody in it and an owner who was not there.
   */
  onClientRequest(socket, 'room:create', ([rawRequest], reply) => {
    const validated = parseArgs(roomCreateRequest, rawRequest, 'room:create');
    if (!validated) {
      reply(invalidRequest());
      return;
    }

    const { gameType, roomName, username, maxPlayers, password, settings } =
      validated;

    const module = registry.moduleFor(gameType);
    if (!module) {
      reply(invalidRequest('That game is not available.'));
      return;
    }

    // The seat count is bounded generically, but each game has its own idea of
    // how many players it can seat.
    if (maxPlayers < module.minPlayers || maxPlayers > module.maxPlayers) {
      reply(invalidRequest());
      return;
    }

    // Whatever the game asked for beyond the envelope. A rejected blob refuses
    // the request rather than creating a room with defaults nobody chose.
    const gameSettings = module.parseSettings(settings);
    if (gameSettings === null) {
      reply(invalidRequest());
      return;
    }

    // Identity comes from the connection, never from the payload.
    const playerId = socket.data.playerId;

    const roomId = generateRoomId();
    const room: Room = {
      gameType,
      roomId,
      roomName,
      owner: { username, playerId },
      status: getRoomStatus(1, maxPlayers),
      currentPlayerCount: 1,
      maxPlayers,
      password,
      playerList: {
        [playerId]: { username, points: 0, isConnected: true },
      },
      isGameStarted: false,
      phaseEndsAt: 0,
      chat: { nextId: 1, messages: [] },
      game: module.createState(gameSettings),
    };

    registry.all[roomId] = room;
    socket.join(roomId);

    // The password is deliberately not echoed back: the creator already has
    // it, and every value that crosses the socket is one more place it can
    // leak from.
    reply({ ok: true, roomId });

    registry.lookup.announce(roomId, 'system', `${username} created the room.`);
    registry.lookup.emitState(room);
    registry.lookup.emitLobby(gameType);
  });
};

export { lobbyEventsHandler };
