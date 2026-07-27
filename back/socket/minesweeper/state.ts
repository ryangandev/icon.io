import type {
  MinesweeperDifficulty,
  MinesweeperLobbyRoomInfo,
  MinesweeperPickResult,
  MinesweeperRoomState,
  MinesweeperSettings,
} from '../../models/types.js';
import type { Room } from '../../libs/rooms/types.js';
import { getRemainingPhaseMs } from '../../libs/utils.js';
import { DIFFICULTIES, createBoard, minesFound, publicView } from './board.js';
import type { Board } from './board.js';

/**
 * Everything Minesweeper knows that no other game would.
 *
 * Compared with Draw & Guess this is a light module, which is the point: the
 * second consumer of the room layer is what says whether the layer was carrying
 * its weight, and it needs one timer and one per-player field rather than three
 * and one.
 */
interface MinesweeperState {
  difficulty: MinesweeperDifficulty;
  /** Server-private layout lives in here; `publicView` is what leaves. */
  board: Board;
  round: number;
  /** This round's picks, player id to cell index. One each, and final. */
  picks: Map<string, number>;
  /**
   * The risk of every cell as it stood when this round opened.
   *
   * Cached rather than recomputed at scoring time, and that is a rule rather
   * than an optimisation: every pick in a round is scored against the same
   * board, the one everybody could see when they chose. Recomputing after the
   * reveals would score people on information they did not have.
   */
  risk: number[];
  /** True while the previous round's outcome is still on screen. */
  isRevealing: boolean;
  lastRound: MinesweeperPickResult[];
}

const createState = (settings: MinesweeperSettings): MinesweeperState => ({
  difficulty: settings.difficulty,
  board: createBoard(settings.difficulty),
  round: 0,
  picks: new Map(),
  risk: [],
  isRevealing: false,
  lastRound: [],
});

const toLobbyInfo = (
  room: Room<MinesweeperState>,
): MinesweeperLobbyRoomInfo => ({
  gameType: 'minesweeper',
  roomId: room.roomId,
  roomName: room.roomName,
  owner: room.owner,
  status: room.status,
  currentPlayerCount: room.currentPlayerCount,
  maxPlayers: room.maxPlayers,
  hasPassword: room.password !== '',
  difficulty: room.game.difficulty,
});

/**
 * The room as its players see it.
 *
 * `lockedIn` says *who* has chosen, never *what* they chose. Publishing the
 * cells would hand everyone else a free read on the board — and worse, would
 * let a player wait to see where the crowd went before choosing, which is the
 * whole reason the picks are simultaneous.
 */
const toRoomState = (room: Room<MinesweeperState>): MinesweeperRoomState => {
  const game = room.game;
  const { width, height } = DIFFICULTIES[game.difficulty];

  return {
    ...toLobbyInfo(room),
    playerList: room.playerList,
    isGameStarted: room.isGameStarted,
    phaseEndsInMs: getRemainingPhaseMs(room),
    difficulty: game.difficulty,
    width,
    height,
    totalMines: game.board.totalMines,
    board: publicView(game.board),
    round: game.round,
    lockedIn: [...game.picks.keys()],
    minesFound: minesFound(game.board),
    lastRound: game.lastRound,
  };
};

export { createState, toLobbyInfo, toRoomState };
export type { MinesweeperState };
