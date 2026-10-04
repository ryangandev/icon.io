import type { MinesweeperDifficulty } from '../../../shared/wire-types';

/**
 * The three boards, for pages that describe one before a room exists (the
 * lobby and the create form). In a room, the snapshot's own size wins.
 */
export const BOARDS: Record<
  MinesweeperDifficulty,
  { width: number; height: number; mines: number }
> = {
  Small: { width: 9, height: 9, mines: 10 },
  Medium: { width: 16, height: 16, mines: 40 },
  Large: { width: 30, height: 16, mines: 99 },
};

export const DIFFICULTIES = Object.keys(BOARDS) as MinesweeperDifficulty[];

/** "Small 9 × 9". */
export function boardName(difficulty: MinesweeperDifficulty): string {
  const { width, height } = BOARDS[difficulty];
  return `${difficulty} ${width} × ${height}`;
}

/** "16 × 16 · 40 mines". */
export function boardDetail(difficulty: MinesweeperDifficulty): string {
  const { width, height, mines } = BOARDS[difficulty];
  return `${width} × ${height} · ${mines} mines`;
}
