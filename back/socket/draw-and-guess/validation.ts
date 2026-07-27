import { z } from 'zod';
import { roomId, username, trimmedString } from '../../libs/validation.js';

/**
 * Draw & Guess's own inbound shapes, built from the same primitives the room
 * layer validates with. These used to sit in `libs/validation.ts` alongside
 * the generic ones, which is fine with one game and misleading with two — a
 * brush size is not something the room layer has an opinion about.
 */

const WORD_MAX = 64; // longest plausible word-bank entry, with room to spare
const MESSAGE_MAX = 40; // matches the chat input

const roundsSetting = z.object({
  rounds: z.number().int().min(1).max(4),
});

const guessRequest = z.tuple([roomId, username, trimmedString(MESSAGE_MAX)]);
const selectWordRequest = z.tuple([roomId, z.string().min(1).max(WORD_MAX)]);

// The canvas is a fixed 798x598; allow a small margin for rounding at the edges.
const coordinate = z.object({
  x: z.number().finite().min(-10).max(1000),
  y: z.number().finite().min(-10).max(1000),
});
const brushColor = z.string().regex(/^#[0-9a-fA-F]{3,8}$/);
const brushSize = z.number().finite().min(1).max(100);

// A stroke is described in full from its first point, so any client can replay
// it without waiting to learn the colour from a later event.
const startDrawingRequest = z.tuple([
  roomId,
  coordinate,
  brushColor,
  brushSize,
]);
const continueDrawingRequest = z.tuple([
  roomId,
  coordinate,
  brushColor,
  brushSize,
]);

export {
  roundsSetting,
  guessRequest,
  selectWordRequest,
  startDrawingRequest,
  continueDrawingRequest,
};
