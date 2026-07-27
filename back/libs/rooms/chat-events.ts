import type { Socket } from 'socket.io';
import { chatRequest, parseArgs } from '../validation.js';
import type { PlayerSessionRegistry } from '../player-session.js';
import type { RoomRegistry } from './registry.js';
import { broadcastToRoom, onClientEvent } from './emit.js';

/**
 * Talking in a room, which every game has and no game owns.
 *
 * Draw & Guess's guess channel is *not* this — a guess is scored, checked
 * against a phase, and refused to the drawer, none of which is chat. It lives
 * with the game, and only plain messages come through here.
 */
const chatEventsHandler = (
  socket: Socket,
  registry: RoomRegistry,
  sessions: PlayerSessionRegistry,
) => {
  onClientEvent(socket, 'chat:send', (...rawArgs: unknown[]) => {
    const validated = parseArgs(chatRequest, rawArgs, 'chat:send');
    if (!validated) return;
    const [roomId, username, message] = validated;

    // Only players in the room may talk in it.
    const playerId = sessions.playerIdFor(socket.id);
    if (!playerId) return;
    if (!registry.lookup.get(roomId)?.playerList[playerId]) return;

    broadcastToRoom(socket, roomId, 'chat:message', username, message);
  });
};

export { chatEventsHandler };
