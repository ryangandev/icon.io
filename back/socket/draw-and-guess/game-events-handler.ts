import type { Socket } from 'socket.io';
import type { DrawAndGuessGameEngine } from './game-engine.js';
import type { PlayerSessionRegistry } from '../../libs/player-session.js';
import {
  parseArgs,
  roomIdOnly,
  selectWordRequest,
} from '../../libs/validation.js';
import { asRoomError } from '../../models/error.js';

/**
 * Socket glue only. Every phase transition is driven by the engine's own clock;
 * the two events a client used to fire to end a phase — `drawingPhaseTimerEnded`
 * and `reviewingPhaseTimerEnded` — no longer exist, because a client that could
 * end a phase could also decline to.
 */
const GameEventsHandler = (
  socket: Socket,
  gameEngine: DrawAndGuessGameEngine,
  sessions: PlayerSessionRegistry,
) => {
  socket.on('startDrawAndGuessGame', (...rawArgs: unknown[]) => {
    const validated = parseArgs(roomIdOnly, rawArgs, 'startDrawAndGuessGame');
    if (!validated) return;
    const [roomId] = validated;

    const playerId = sessions.playerIdFor(socket.id);
    if (!playerId) return;

    try {
      gameEngine.startGame(roomId, playerId);
    } catch (error) {
      console.log(error);
      socket.emit('roomError', asRoomError(error));
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

    const playerId = sessions.playerIdFor(socket.id);
    if (!playerId) return;

    gameEngine.selectWord(roomId, playerId, word);
  });
};

export { GameEventsHandler };
