import { describe, expect, it } from 'vitest';
import {
  deal,
  HIGHEST_CARD,
  levelsFor,
  listOf,
  LOWEST_CARD,
} from '../../shared/hush.js';
import { seededRandom } from '../../shared/seed.js';

describe('a game', () => {
  it('is 9 minus the players levels, about 60 cards whatever its size', () => {
    expect([2, 3, 4].map(levelsFor)).toEqual([7, 6, 5]);
    for (const players of [2, 3, 4]) {
      const levels = levelsFor(players);
      const dealt = (players * levels * (levels + 1)) / 2;
      expect(dealt).toBeGreaterThanOrEqual(56);
      expect(dealt).toBeLessThanOrEqual(63);
    }
  });

  it('describes a room of one, or of too many, as its nearest size', () => {
    expect(levelsFor(0)).toBe(7);
    expect(levelsFor(1)).toBe(7);
    expect(levelsFor(6)).toBe(5);
  });
});

describe('the deal', () => {
  const ids = ['maya', 'ryan', 'leo', 'sam'];

  it.each([1, 3, 5])('gives everybody %i cards at that level', (level) => {
    const hands = deal(ids, level, seededRandom(level));
    expect(Object.keys(hands)).toEqual(ids);
    for (const hand of Object.values(hands)) expect(hand).toHaveLength(level);
  });

  it('deals every card once, from the deck, each hand lowest first', () => {
    for (let seed = 0; seed < 50; seed++) {
      const hands = deal(ids, 5, seededRandom(seed));
      const cards = Object.values(hands).flat();
      expect(new Set(cards).size).toBe(cards.length);
      for (const card of cards) {
        expect(Number.isInteger(card)).toBe(true);
        expect(card).toBeGreaterThanOrEqual(LOWEST_CARD);
        expect(card).toBeLessThanOrEqual(HIGHEST_CARD);
      }
      for (const hand of Object.values(hands)) {
        expect(hand).toEqual(hand.toSorted((a, b) => a - b));
      }
    }
  });

  it('shuffles the whole deck: any card can be dealt', () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 200; seed++) {
      for (const hand of Object.values(deal(ids, 5, seededRandom(seed)))) {
        for (const card of hand) seen.add(card);
      }
    }
    expect(seen.size).toBe(HIGHEST_CARD - LOWEST_CARD + 1);
  });

  it('deals the extremes of the random source inside the deck', () => {
    for (const random of [() => 0, () => 0.999_999_999]) {
      const cards = Object.values(deal(ids, 7, random)).flat();
      expect(new Set(cards).size).toBe(28);
      expect(Math.min(...cards)).toBeGreaterThanOrEqual(LOWEST_CARD);
      expect(Math.max(...cards)).toBeLessThanOrEqual(HIGHEST_CARD);
    }
  });

  it('refuses a deal the deck cannot cover', () => {
    expect(() => deal(ids, 26, Math.random)).toThrow(
      'Not enough cards to deal.',
    );
  });
});

describe('a list in the chat', () => {
  it('reads as a sentence', () => {
    expect(listOf([])).toBe('');
    expect(listOf(['47'])).toBe('47');
    expect(listOf(['47', '51'])).toBe('47 and 51');
    expect(listOf(['Ryan held 47', 'Sam held 49', 'Leo held 50'])).toBe(
      'Ryan held 47, Sam held 49 and Leo held 50',
    );
  });
});
