import type { PairsBoard } from '../../../../shared/wire-types';
import { PAIRS_BOARDS } from '../../../../shared/pairs';
import type { pairs as en } from '../en/pairs';

const SIZES: Record<PairsBoard, string> = { Small: '小', Large: '大' };

export const pairs: typeof en = {
  boardName: (board) => {
    const { side } = PAIRS_BOARDS[board];
    return `${SIZES[board]} ${side} × ${side}`;
  },
};
