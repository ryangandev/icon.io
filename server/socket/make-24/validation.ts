import { z } from 'zod';
import { roomId } from '../../libs/validation.js';
import { HAND_SIZE, OPERATORS } from '../../../shared/make-24.js';

/** Make 24's own inbound shapes. */

const handsSetting = z.object({
  hands: z.union([z.literal(5), z.literal(10)]),
});

// A card index is never past the hand; whether the step can be taken on the
// cards as they stand is the engine's to check, by replaying the steps.
const cardIndex = z
  .number()
  .int()
  .min(0)
  .max(HAND_SIZE - 1);

const step = z.object({
  left: cardIndex,
  op: z.enum(OPERATORS as [string, ...string[]]),
  right: cardIndex,
});

// Four cards become one in exactly three steps.
const solveRequest = z.tuple([roomId, z.array(step).length(HAND_SIZE - 1)]);

export { handsSetting, solveRequest };
