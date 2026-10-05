import { z } from 'zod';
import { roomId } from '../../libs/validation.js';
import { BOARDS, PAIRS_BOARDS } from '../../../shared/pairs.js';
import type { PairsBoard } from '../../models/types.js';

/** Pairs' own inbound shapes. */

const boardSetting = z.object({
  board: z.enum(BOARDS as [PairsBoard, ...PairsBoard[]]),
});

// A place is never past the largest board; whether it is on this room's board,
// and whether it may be turned over now, is the engine's to check.
const largest = Math.max(...BOARDS.map((board) => PAIRS_BOARDS[board].side));
const flipRequest = z.tuple([
  roomId,
  z
    .number()
    .int()
    .min(0)
    .max(largest * largest - 1),
]);

export { boardSetting, flipRequest };
