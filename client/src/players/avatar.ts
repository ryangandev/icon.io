import { AVATAR_TONES, type AvatarTone } from '../ui';

/**
 * Up to two letters for an avatar: the first letters of the first two words,
 * or the first two letters of a single word. Counted in characters, not UTF-16
 * units, so a name in any script keeps whole letters.
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length >= 2
      ? [Array.from(words[0])[0], Array.from(words[1])[0]]
      : Array.from(words[0] ?? '').slice(0, 2);
  return letters.join('').toLocaleUpperCase();
}

/**
 * A player's colour, from their name: the same everywhere they appear, the
 * header included, which knows the name before the server knows the player.
 */
export function toneOf(name: string): AvatarTone {
  let hash = 0;
  for (const char of name.trim()) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}
