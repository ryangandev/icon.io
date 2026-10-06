import type { PairsBoard } from '../../../../shared/wire-types';
import { PAIRS_BOARDS } from '../../../../shared/pairs';

const SIZES: Record<PairsBoard, string> = { Small: 'Small', Large: 'Large' };

export const pairs = {
  /** "Large 6 × 6", as a room's setting reads. */
  boardName: (board: PairsBoard) => {
    const { side } = PAIRS_BOARDS[board];
    return `${SIZES[board]} ${side} × ${side}`;
  },
};
