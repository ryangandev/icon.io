import { z } from 'zod';
import { roomId } from '../../libs/validation.js';
import { DECK_SIZE } from '../../../shared/trios.js';

/** Trios' own inbound shapes. */

const triosSetting = z.object({
  trios: z.union([z.literal(10), z.literal(20)]),
});

// Three cards by their numbers. Whether they are different, on the table and
// a trio is the engine's to judge.
const claimRequest = z.tuple([
  roomId,
  z
    .array(
      z
        .number()
        .int()
        .min(0)
        .max(DECK_SIZE - 1),
    )
    .length(3),
]);

export { triosSetting, claimRequest };
