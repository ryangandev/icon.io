import type {
  MinesweeperCellView,
  MinesweeperDifficulty,
} from './wire-types.js';

/**
 * Minesweeper geometry that a room on the server and a game on your own in
 * the browser both need, so the two can never disagree about a board.
 *
 * Cells are a flat row-major array: `index = y * width + x`.
 */

/** A cell nobody has opened yet, as a board is seen. */
export const HIDDEN: MinesweeperCellView = -1;
/** A mine somebody hit, now common knowledge. */
export const KNOWN_MINE: MinesweeperCellView = 9;

export interface BoardSize {
  width: number;
  height: number;
  mines: number;
}

/**
 * The three board sizes. Small is a two-minute game; Large is closer to twenty
 * and gives the probability solver something to chew on - a bigger board means
 * bigger frontiers, which means more cells whose risk is a real number rather
 * than 0 or 1.
 */
export const BOARD_SIZES: Readonly<Record<MinesweeperDifficulty, BoardSize>> = {
  Small: { width: 9, height: 9, mines: 10 },
  Medium: { width: 16, height: 16, mines: 40 },
  Large: { width: 30, height: 16, mines: 99 },
};

export const DIFFICULTIES = Object.keys(
  BOARD_SIZES,
) as readonly MinesweeperDifficulty[];

/** The up to eight cells around `index`. */
export function neighboursOf(
  board: { width: number; height: number },
  index: number,
): number[] {
  const { width, height } = board;
  const x = index % width;
  const y = Math.floor(index / width);
  const out: number[] = [];

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      out.push(ny * width + nx);
    }
  }

  return out;
}
