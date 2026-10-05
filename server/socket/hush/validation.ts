import { z } from 'zod';
import { roomId } from '../../libs/validation.js';
import { HIGHEST_CARD, LOWEST_CARD } from '../../../shared/hush.js';

/** Hush's own inbound shapes. */

// Nothing to choose but the seats, which the room layer checks.
const noSettings = z.object({}).strict();

const readyRequest = z.tuple([roomId]);

// Whether the card is the player's lowest, and may be played now, is the
// engine's to check.
const playRequest = z.tuple([
  roomId,
  z.number().int().min(LOWEST_CARD).max(HIGHEST_CARD),
]);

export { noSettings, playRequest, readyRequest };
