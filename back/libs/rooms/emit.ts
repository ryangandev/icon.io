import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvent,
  GameType,
  ServerToClientEvent,
} from '../../../shared/wire-types.js';
import type { PlayerSessionRegistry } from '../player-session.js';

/**
 * Every emit and every listener goes through here, so that an event name is
 * checked against `shared/wire-types.d.ts` rather than spelled out twice and
 * hoped about.
 *
 * The names used to be bare strings on both sides of the socket, which is a
 * silent failure by construction: a renamed event compiles perfectly on the
 * half that was not renamed, and simply stops arriving. There are about forty
 * of them now across two games, which is well past the number a person can
 * keep matched by hand.
 */

/** The socket.io room a lobby's subscribers sit in, one per game. */
const lobbyChannel = (gameType: GameType): string => `lobby:${gameType}`;

const emitToRoom = (
  io: Server,
  roomId: string,
  event: ServerToClientEvent,
  ...args: unknown[]
): void => {
  io.to(roomId).emit(event, ...args);
};

const emitToLobby = (
  io: Server,
  gameType: GameType,
  event: ServerToClientEvent,
  ...args: unknown[]
): void => {
  io.to(lobbyChannel(gameType)).emit(event, ...args);
};

const emitToSocket = (
  socket: Socket,
  event: ServerToClientEvent,
  ...args: unknown[]
): void => {
  socket.emit(event, ...args);
};

/** Everyone in the room except the sender. */
const broadcastToRoom = (
  socket: Socket,
  roomId: string,
  event: ServerToClientEvent,
  ...args: unknown[]
): void => {
  socket.broadcast.to(roomId).emit(event, ...args);
};

/**
 * Sends to whichever socket a player is currently using. Room state is keyed
 * by player id; socket.io still addresses sockets.
 */
const emitToPlayer = (
  io: Server,
  sessions: PlayerSessionRegistry,
  playerId: string,
  event: ServerToClientEvent,
  ...args: unknown[]
): void => {
  const socketId = sessions.socketIdFor(playerId);
  if (socketId) io.to(socketId).emit(event, ...args);
};

/** The inbound half of the same check. */
const onClientEvent = (
  socket: Socket,
  event: ClientToServerEvent,
  handler: (...args: unknown[]) => void,
): void => {
  socket.on(event, handler);
};

export {
  lobbyChannel,
  emitToRoom,
  emitToLobby,
  emitToSocket,
  emitToPlayer,
  broadcastToRoom,
  onClientEvent,
};
