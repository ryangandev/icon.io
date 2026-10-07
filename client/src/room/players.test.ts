import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { zh } from '../i18n/zh';
import { listNames, ordinal, placesOf } from './players';

describe('the room’s standings grammar', () => {
  it('joins names in the player’s language, including empty and single lists', () => {
    expect(listNames([], zh)).toBe('');
    expect(listNames(['Ryan'], zh)).toBe('Ryan');
    expect(listNames(['Ryan', 'Maya', 'Sam'], en)).toBe('Ryan, Maya and Sam');
    expect(listNames(['Ryan', 'Maya', 'Sam'], zh)).toBe('Ryan、Maya 和 Sam');
  });

  it('uses the correct English suffix and natural Chinese places', () => {
    expect(
      [1, 2, 3, 4, 11, 12, 13, 21].map((place) => ordinal(place, en)),
    ).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st']);
    expect(ordinal(2, zh)).toBe('第 2 名');
    expect(placesOf([{ points: 4 }, { points: 4 }, { points: 2 }])).toEqual([
      1, 1, 3,
    ]);
  });
});
