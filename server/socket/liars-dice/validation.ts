import { z } from 'zod';
import { roomId } from '../../libs/validation.js';
import {
  DICE_PER_PLAYER,
  HIGHEST_FACE,
  isDicePerPlayer,
  LOWEST_FACE,
} from '../../../shared/liars-dice.js';

/** Liar's Dice's own inbound shapes. */

const diceSetting = z.object({
  dicePerPlayer: z.number().refine(isDicePerPlayer, 'must be 3 or 5'),
});

// A count is never past the most dice a table can hold; whether it is a raise
// on this table, and whether it is this player's turn, is the engine's to check.
const MOST_DICE = 6 * Math.max(...DICE_PER_PLAYER);
const bidRequest = z.tuple([
  roomId,
  z.number().int().min(1).max(MOST_DICE),
  z.number().int().min(LOWEST_FACE).max(HIGHEST_FACE),
]);

const callRequest = z.tuple([roomId]);

export { bidRequest, callRequest, diceSetting };
