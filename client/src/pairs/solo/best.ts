import type { PairsBoard } from '../../../../shared/wire-types';
import { readStored, writeStored } from '../../solo/device-store';

/**
 * The best Pairs game on each board on this device: fewest turns, and for
 * the same turns, the quicker time.
 */
export interface PairsBest {
  turns: number;
  ms: number;
}

const key = (board: PairsBoard) => `best:pairs:${board}`;

export function readPairsBest(board: PairsBoard): PairsBest | null {
  try {
    const stored: unknown = JSON.parse(readStored(key(board)) ?? 'null');
    if (
      typeof stored === 'object' &&
      stored !== null &&
      'turns' in stored &&
      'ms' in stored &&
      Number.isInteger(stored.turns) &&
      Number.isFinite(stored.ms) &&
      (stored.turns as number) > 0 &&
      (stored.ms as number) >= 0
    ) {
      return { turns: stored.turns as number, ms: stored.ms as number };
    }
    return null;
  } catch {
    return null;
  }
}

export const beats = (a: PairsBest, b: PairsBest) =>
  a.turns < b.turns || (a.turns === b.turns && a.ms < b.ms);

/** Keeps `result` when it beats the board's best, and says what it beat. */
export function recordPairsBest(board: PairsBoard, result: PairsBest) {
  const previous = readPairsBest(board);
  const isBest = previous === null || beats(result, previous);
  if (isBest) writeStored(key(board), JSON.stringify(result));
  return { previous, isBest };
}
