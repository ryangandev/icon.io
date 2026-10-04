/**
 * Seeds: a short code that deals the same game every time, so a challenge
 * link is just its seed. Make 24's hands and Pairs' decks are dealt from one.
 */

/**
 * A seeded source of numbers in [0, 1) (mulberry32), so a seed always deals
 * the same game.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed for a challenge link: six letters and digits. */
export const SEED_PATTERN = /^[0-9a-z]{6}$/;

export function newSeed(random: () => number = Math.random): string {
  return Array.from({ length: 6 }, () =>
    Math.floor(random() * 36).toString(36),
  ).join('');
}

/** The 32-bit number a seed stands for. */
export function seedNumber(seed: string): number {
  let hash = 2166136261;
  for (const char of seed) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  return hash >>> 0;
}
