import type {
  DrawAndGuessSettings,
  DrawAndGuessState,
} from '../../models/types.js';
import type { GameContext, GameModule, Room } from '../../libs/rooms/types.js';
import { emitToSocket, type IoSocket } from '../../libs/rooms/emit.js';
import { parseArgs } from '../../libs/validation.js';
import type { PhaseDurationsInSeconds } from '../../libs/game-clock.js';
import { createDrawAndGuessGameEngine } from './game-engine.js';
import { gameEventsHandler } from './game-events-handler.js';
import { whiteboardCanvasEventHandler } from './whiteboard-canvas-events-handler.js';
import { createState, toLobbyInfo, toRoomState } from './state.js';
import { roundsSetting } from './validation.js';

/**
 * Draw & Guess, as the room layer sees it.
 *
 * Everything below is a hand-off: one object the server registers by name, and
 * one it could register a second of without touching a line of the room layer.
 *
 * This is also where the abstraction is either right or wrong, and it is worth
 * being able to point at: the room layer calls the members below and nothing
 * else. It never sees a drawer queue, a word, a canvas or a phase, and it holds
 * none of this game's timers; `disposeRoom` and `dispose` are how it asks for
 * them to be dropped without knowing what they are.
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
     * The drawing so far, which is too large to travel in every snapshot,
     * sent to one socket at the one moment its listeners are known to be
     * live. A joiner, a player returning from a reload and a drawer resuming
     * their own turn all arrive here. The word needs nothing of its own: the
     * drawer's snapshot carries it.
     */
    syncTo: (socket: IoSocket, room: Room<DrawAndGuessState>) => {
      emitToSocket(socket, 'dg:canvas:sync', room.roomId, [
        ...room.game.canvas.strokes,
      ]);
    },

    handleChat: (room, playerId, text) =>
      engine.handleChat(room, playerId, text),

    startGame: (room, playerId) => engine.startGame(room, playerId),
    onDeparture: (room, playerId) =>
      engine.handlePlayerDeparture(room, playerId),
    onDisconnect: (room, playerId) =>
      engine.handleDrawerDisconnect(room, playerId),
    onReturn: (room, playerId) => engine.handleDrawerReturn(room, playerId),

    disposeRoom: (roomId) => engine.disposeRoom(roomId),
    dispose: () => engine.dispose(),

    registerHandlers: (socket: IoSocket) => {
      gameEventsHandler(socket, ctx, engine);
      whiteboardCanvasEventHandler(socket, ctx);
    },
  };
};

export { createDrawAndGuessModule };
