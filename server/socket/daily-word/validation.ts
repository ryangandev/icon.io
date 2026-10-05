import { z } from 'zod';
import { roomId } from '../../libs/validation.js';
import { WORD_LENGTH } from '../../../shared/daily-word.js';

/** Daily Word's own inbound shapes. */

const roundsSetting = z.object({
  rounds: z.union([z.literal(3), z.literal(5)]),
});

// Five letters, either case; whether it is a word is the engine's to check.
const guessRequest = z.tuple([
  roomId,
  z
    .string()
    .regex(new RegExp(`^[A-Za-z]{${WORD_LENGTH}}$`))
    .transform((word) => word.toLowerCase()),
]);

export { roundsSetting, guessRequest };
