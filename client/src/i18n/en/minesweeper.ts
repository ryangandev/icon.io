import type { MinesweeperDifficulty } from '../../../../shared/wire-types';
import { BOARD_SIZES } from '../../../../shared/minesweeper';

const SIZES: Record<MinesweeperDifficulty, string> = {
  Small: 'Small',
  Medium: 'Medium',
  Large: 'Large',
};

export const minesweeper = {
  /** "Small 9 × 9", as a room's setting reads. */
  boardName: (difficulty: MinesweeperDifficulty) => {
    const { width, height } = BOARD_SIZES[difficulty];
    return `${SIZES[difficulty]} ${width} × ${height}`;
  },
};
