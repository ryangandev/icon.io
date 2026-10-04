/*
 * What a game on your own keeps on this device: best results and the last
 * choice made. localStorage, unlike the session's identity, because a best is
 * the device's, not the tab's. Storage can be blocked or full; then nothing
 * is kept and the games play on.
 */

const PREFIX = 'zumpo:solo:';

export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    // Not kept; the game is unaffected.
  }
}

/** A best kept as a non-negative number, lower being better. */
export function readBest(key: string): number | null {
  const stored = Number(readStored(`best:${key}`));
  return Number.isFinite(stored) && stored > 0 ? stored : null;
}

/**
 * Keeps `result` when it beats the stored best, and says what it beat. Lower
 * is better: milliseconds, or turns.
 */
export function recordBest(
  key: string,
  result: number,
): { previous: number | null; isBest: boolean } {
  const previous = readBest(key);
  const isBest = previous === null || result < previous;
  if (isBest) writeStored(`best:${key}`, String(result));
  return { previous, isBest };
}

/** "3:05": a run's time, in whole seconds. */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
