import type { MinesweeperDifficulty } from '../../../../shared/wire-types';
import { BOARD_SIZES } from '../../../../shared/minesweeper';
import type { minesweeper as en } from '../en/minesweeper';

const SIZES: Record<MinesweeperDifficulty, string> = {
  Small: '小',
  Medium: '中',
  Large: '大',
};

export const minesweeper: typeof en = {
  boardName: (difficulty) => {
    const { width, height } = BOARD_SIZES[difficulty];
    return `${SIZES[difficulty]} ${width} × ${height}`;
  },
};
