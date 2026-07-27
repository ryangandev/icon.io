import type { Socket } from 'socket.io';
import type {
  DrawAndGuessSettings,
  DrawAndGuessState,
} from '../../models/types.js';
import type { GameContext, GameModule, Room } from '../../libs/rooms/types.js';
import { emitToSocket } from '../../libs/rooms/emit.js';
import { parseArgs } from '../../libs/validation.js';
import type { PhaseDurationsInSeconds } from '../../libs/game-clock.js';
import { createDrawAndGuessGameEngine } from './game-engine.js';
import { guessEventsHandler } from './chat-events-handler.js';
import { gameEventsHandler } from './game-events-handler.js';
import { whiteboardCanvasEventHandler } from './whiteboard-canvas-events-handler.js';
import { createState, toLobbyInfo, toRoomState } from './state.js';
import { roundsSetting } from './validation.js';

/**
 * Draw & Guess, as the room layer sees it.
 *
 * Everything below is a hand-off. What used to be five handler functions wired
 * straight into `app.ts` — each taking `rooms`, `sessions` and the engine, each
 * naming Draw & Guess in its events — is now one object the server registers by
 * name, and one it could register a second of without touching a line of the
 * room layer.
 *
 * This is also where the abstraction is either right or wrong, and it is worth
 * being able to point at: the room layer calls exactly the nine members below.
 * It never sees a drawer queue, a word, a canvas or a phase, and it holds none
 * of this game's timers — `disposeRoom` and `dispose` are how it asks for them
 * to be dropped without knowing what they are.
 */
const createDrawAndGuessModule = (
  ctx: GameContext,
  phaseDurations?: PhaseDurationsInSeconds,
): GameModule<DrawAndGuessState, DrawAndGuessSettings> => {
  const engine = createDrawAndGuessGameEngine(ctx, phaseDurations);

  return {
    gameType: 'draw-and-guess',
    minPlayers: 2,
    maxPlayers: 8,

    parseSettings: (raw) =>
      parseArgs(roundsSetting, raw, 'room:create (draw-and-guess)'),
    createState,
    toLobbyInfo,
    toRoomState,

    /**
     * What the broadcast cannot carry, sent to one socket at the one moment
     * its listeners are known to be live.
     *
     * A joiner, a player returning from a reload and a drawer resuming their
     * own turn all arrive here, and all three used to find a blank board.
     */
    syncTo: (socket: Socket, room: Room<DrawAndGuessState>, playerId) => {
      emitToSocket(socket, 'dg:canvas:sync', room.game.canvas.strokes);

      // The word is drawer-private, so the snapshot omits it while it is in
      // play. A drawer who reloads lost their copy of it along with the page,
      // and cannot draw a word they can no longer see — so send it again, to
      // them alone.
      if (room.game.currentDrawer !== playerId) return;

      if (room.game.isWordSelectingPhase) {
        emitToSocket(socket, 'dg:word-choices', room.game.wordChoices);
      } else if (room.game.isDrawingPhase) {
        emitToSocket(socket, 'dg:word', room.game.currentWord);
      }
    },

    startGame: (room, playerId) => engine.startGame(room, playerId),
    onDeparture: (room, playerId) =>
      engine.handlePlayerDeparture(room, playerId),
    onDisconnect: (room, playerId) =>
      engine.handleDrawerDisconnect(room, playerId),
    onReturn: (room, playerId) => engine.handleDrawerReturn(room, playerId),

    disposeRoom: (roomId) => engine.disposeRoom(roomId),
    dispose: () => engine.dispose(),

    registerHandlers: (socket: Socket) => {
      guessEventsHandler(socket, ctx, engine);
      gameEventsHandler(socket, ctx, engine);
      whiteboardCanvasEventHandler(socket, ctx);
    },
  };
};

export { createDrawAndGuessModule };
