import { z } from 'zod';
import { roomId } from '../../libs/validation.js';

/** Minesweeper's own inbound shapes. */

const difficultySetting = z.object({
  difficulty: z.enum(['Small', 'Medium', 'Large']),
});

// The largest board is 30×16, so any index a real client sends is under 480.
// The engine checks the cell is actually pickable; this only bounds the number.
const pickRequest = z.tuple([roomId, z.number().int().min(0).max(479)]);

export { difficultySetting, pickRequest };
