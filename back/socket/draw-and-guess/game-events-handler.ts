import type { Socket } from 'socket.io';
import type { DrawAndGuessGameEngine } from './game-engine.js';
import type { GameContext } from '../../libs/rooms/types.js';
import { onClientEvent } from '../../libs/rooms/emit.js';
import { parseArgs } from '../../libs/validation.js';
import { selectWordRequest } from './validation.js';

/**
 * Socket glue only. Every phase transition is driven by the engine's own clock;
 * the two events a client used to fire to end a phase — `drawingPhaseTimerEnded`
 * and `reviewingPhaseTimerEnded` — no longer exist, because a client that could
 * end a phase could also decline to.
 *
 * Starting the game is not here: that is `game:start`, which every game answers,
 * and the room layer routes it to whichever module owns the room.
 */
const gameEventsHandler = (
  socket: Socket,
  ctx: GameContext,
  gameEngine: DrawAndGuessGameEngine,
) => {
  onClientEvent(socket, 'dg:select-word', (...rawArgs: unknown[]) => {
    const validated = parseArgs(selectWordRequest, rawArgs, 'dg:select-word');
    if (!validated) return;
    const [roomId, word] = validated;

    const playerId = ctx.sessions.playerIdFor(socket.id);
    if (!playerId) return;

    gameEngine.selectWord(roomId, playerId, word);
  });
};

export { gameEventsHandler };
