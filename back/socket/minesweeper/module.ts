import type { Socket } from 'socket.io';
import type { MinesweeperSettings } from '../../models/types.js';
import type { GameModule, GameContext } from '../../libs/rooms/types.js';
import { onClientEvent } from '../../libs/rooms/emit.js';
import { parseArgs } from '../../libs/validation.js';
import type { MinesweeperDurationsInSeconds } from '../../libs/game-clock.js';
import { createMinesweeperGameEngine } from './game-engine.js';
import { createState, toLobbyInfo, toRoomState } from './state.js';
import type { MinesweeperState } from './state.js';
import { difficultySetting, pickRequest } from './validation.js';

/**
 * Minesweeper, as the room layer sees it.
 *
 * Worth comparing with `draw-and-guess/module.ts`, because the two together are
 * the argument that the room layer is real rather than Draw & Guess wearing a
 * hat. This one keeps **one** timer where that one keeps three, needs **no**
 * per-player state of its own beyond the score every game has, and its `syncTo`
 * is empty because a Minesweeper room holds nothing an arriving player is not
 * already sent in the snapshot — no private word, no separate canvas.
 *
 * The room layer needed no changes to accommodate any of that, which is the
 * result the extraction was hoping for.
 */
const createMinesweeperModule = (
  ctx: GameContext,
  durations?: MinesweeperDurationsInSeconds,
): GameModule<MinesweeperState, MinesweeperSettings> => {
  const engine = createMinesweeperGameEngine(ctx, durations);

  return {
    gameType: 'minesweeper',
    minPlayers: 2,
    maxPlayers: 8,

    parseSettings: (raw) =>
      parseArgs(difficultySetting, raw, 'room:create (minesweeper)'),
    createState,
    toLobbyInfo,
    toRoomState,

    // Nothing to catch up on: the board, the round and the last result all
    // travel in the room snapshot the layer has already sent.
    syncTo: () => {},

    startGame: (room, playerId) => engine.startGame(room, playerId),
    onDeparture: (room, playerId) =>
      engine.handlePlayerDeparture(room, playerId),
    onDisconnect: (room) => engine.handleDisconnect(room),
    onReturn: () => {},

    disposeRoom: (roomId) => engine.disposeRoom(roomId),
    dispose: () => engine.dispose(),

    registerHandlers: (socket: Socket) => {
      onClientEvent(socket, 'ms:pick', (...rawArgs: unknown[]) => {
        const validated = parseArgs(pickRequest, rawArgs, 'ms:pick');
        if (!validated) return;
        const [roomId, index] = validated;

        // Identity comes from the connection, never from the payload.
        const playerId = ctx.sessions.playerIdFor(socket.id);
        if (!playerId) return;

        engine.pick(roomId, playerId, index);
      });
    },
  };
};

export { createMinesweeperModule };
