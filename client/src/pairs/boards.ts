import type { PairsBoard } from '../../../shared/wire-types';
import { PAIRS_BOARDS } from '../../../shared/pairs';

export { BOARDS } from '../../../shared/pairs';

/** "Large 6 × 6", as a room's setting reads. */
export function boardName(board: PairsBoard): string {
  const { side } = PAIRS_BOARDS[board];
  return `${board} ${side} × ${side}`;
}

/** "Large · 6 × 6", as a game on your own is labelled. */
export function boardLabel(board: PairsBoard): string {
  const { side } = PAIRS_BOARDS[board];
  return `${board} · ${side} × ${side}`;
}

/** "6 × 6 · 18 pairs". */
export function boardDetail(board: PairsBoard): string {
  const { side, pairs } = PAIRS_BOARDS[board];
  return `${side} × ${side} · ${pairs} pairs`;
}
