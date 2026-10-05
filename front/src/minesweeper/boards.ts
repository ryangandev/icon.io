import type { MinesweeperDifficulty } from '../../../shared/wire-types';
import { BOARD_SIZES } from '../../../shared/minesweeper';

export { DIFFICULTIES } from '../../../shared/minesweeper';

/** "Small 9 × 9". */
export function boardName(difficulty: MinesweeperDifficulty): string {
  const { width, height } = BOARD_SIZES[difficulty];
  return `${difficulty} ${width} × ${height}`;
}

/** "16 × 16 · 40 mines". */
export function boardDetail(difficulty: MinesweeperDifficulty): string {
  const { width, height, mines } = BOARD_SIZES[difficulty];
  return `${width} × ${height} · ${mines} mines`;
}
