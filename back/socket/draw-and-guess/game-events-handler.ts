import type { Socket } from 'socket.io';
import type { DrawAndGuessGameEngine } from './game-engine.js';
import {
  parseArgs,
  roomIdOnly,
  selectWordRequest,
} from '../../libs/validation.js';

/**
 * Socket glue only. Every phase transition is driven by the engine's own clock;
 * the two events a client used to fire to end a phase — `drawingPhaseTimerEnded`
 * and `reviewingPhaseTimerEnded` — no longer exist, because a client that could
 * end a phase could also decline to.
 */
const GameEventsHandler = (
  socket: Socket,
  gameEngine: DrawAndGuessGameEngine,
) => {
  socket.on('startDrawAndGuessGame', (...rawArgs: unknown[]) => {
    const validated = parseArgs(roomIdOnly, rawArgs, 'startDrawAndGuessGame');
    if (!validated) return;
    const [roomId] = validated;

    try {
      gameEngine.startGame(roomId);
    } catch (error: any) {
      console.log(error);
      socket.emit('roomError', {
        status: true,
        message: error.message,
        errorType: error.errorType,
      });
    }
  });

  socket.on('drawerSelectWordFinished', (...rawArgs: unknown[]) => {
    const validated = parseArgs(
      selectWordRequest,
      rawArgs,
      'drawerSelectWordFinished',
    );
    if (!validated) return;
    const [roomId, word] = validated;

    gameEngine.selectWord(roomId, socket.id, word);
  });
};

export { GameEventsHandler };
