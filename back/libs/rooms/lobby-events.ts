import type { Socket } from 'socket.io';
import type { GameType, OwnerInfo } from '../../../shared/wire-types.js';
import { generateRoomId, getRoomStatus } from '../utils.js';
import { parseArgs, roomCreateRequest, gameTypeOnly } from '../validation.js';
import type { PlayerSessionRegistry } from '../player-session.js';
import type { RoomRegistry } from './registry.js';
import type { Room } from './types.js';
import { emitToSocket, lobbyChannel, onClientEvent } from './emit.js';

/**
 * Listing rooms and making one. Neither depends on what is played in them:
 * a create request is a name, a number of seats, an optional password, and a
 * blob only the game's own module can read.
 *
 * A lobby is a socket.io room now (`lobby:draw-and-guess`) rather than an
 * `io.emit` to the whole server. With one game the difference was invisible;
 * with two, every Minesweeper room appearing would otherwise wake every client
 * sitting in the Draw & Guess lobby.
 */
const lobbyEventsHandler = (
  socket: Socket,
  registry: RoomRegistry,
  sessions: PlayerSessionRegistry,
) => {
  onClientEvent(socket, 'lobby:subscribe', (...rawArgs: unknown[]) => {
    const validated = parseArgs(gameTypeOnly, rawArgs, 'lobby:subscribe');
    if (!validated) return;
    const [gameType] = validated;
    if (!registry.moduleFor(gameType)) return;

    socket.join(lobbyChannel(gameType));

    // The subscriber wants the list now, not at the next change.
    const module = registry.moduleFor(gameType)!;
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

  onClientEvent(socket, 'room:create', (...rawArgs: unknown[]) => {
    const validated = parseArgs(roomCreateRequest, rawArgs[0], 'room:create');
    if (!validated) return;

    const {
      gameType,
      roomName,
      ownerUsername,
      maxPlayers,
      password,
      settings,
    } = validated;

    const module = registry.moduleFor(gameType as GameType);
    if (!module) return;

    // The seat count is bounded generically, but each game has its own idea of
    // how many players it can seat — Minesweeper's turn window does not scale
    // the way a drawing phase does.
    if (maxPlayers < module.minPlayers || maxPlayers > module.maxPlayers) {
      return;
    }

    // Whatever the game asked for beyond the envelope. A rejected blob drops
    // the request rather than creating a room with defaults nobody chose.
    const gameSettings = module.parseSettings(settings);
    if (gameSettings === null) return;

    const ownerPlayerId = sessions.playerIdFor(socket.id);
    if (!ownerPlayerId) return;

    const roomId = generateRoomId();
    const owner: OwnerInfo = {
      username: ownerUsername,
      playerId: ownerPlayerId,
    };

    const room: Room = {
      gameType: gameType as GameType,
      roomId,
      roomName,
      owner,
      status: getRoomStatus(0, maxPlayers),
      currentPlayerCount: 0,
      maxPlayers,
      password,
      playerList: {},
      isGameStarted: false,
      phaseEndsAt: 0,
      game: module.createState(gameSettings),
    };

    registry.all[roomId] = room;

    // The password is deliberately not echoed back — the creator already has
    // it, and every value that crosses the socket is one more place it can
    // leak from.
    emitToSocket(socket, 'room:created', roomId);
    registry.lookup.emitLobby(gameType as GameType);
  });
};

export { lobbyEventsHandler };
