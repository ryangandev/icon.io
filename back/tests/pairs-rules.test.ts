import { describe, expect, it } from 'vitest';
import {
  BOARDS,
  dealDeck,
  longestStreak,
  PAIRS_BOARDS,
  SYMBOL_COUNT,
} from '../../shared/pairs.js';
import { seededRandom, seedNumber } from '../../shared/seed.js';

describe('the deal', () => {
  it.each(BOARDS)('fills a %s board with every symbol twice', (board) => {
    const { side, pairs } = PAIRS_BOARDS[board];
    const deck = dealDeck(board, seededRandom(3));
    expect(deck).toHaveLength(side * side);
    const counts = new Map<number, number>();
    for (const symbol of deck)
      counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
    expect(counts.size).toBe(pairs);
    for (const [symbol, count] of counts) {
      expect(symbol).toBeGreaterThanOrEqual(0);
      expect(symbol).toBeLessThan(SYMBOL_COUNT);
      expect(count).toBe(2);
    }
  });

  it('uses every symbol on a Large board', () => {
    expect(new Set(dealDeck('Large', seededRandom(5))).size).toBe(SYMBOL_COUNT);
  });

  it('deals the same deck from the same seed, and another from another', () => {
    const deal = (seed: string) =>
      dealDeck('Large', seededRandom(seedNumber(seed)));
    expect(deal('k3f9x2')).toEqual(deal('k3f9x2'));
    expect(deal('k3f9x2')).not.toEqual(deal('zzzzzz'));
  });

  it('shuffles: the same symbols do not keep to the same places', () => {
    const decks = Array.from({ length: 20 }, (_, seed) =>
      dealDeck('Small', seededRandom(seed)),
    );
    expect(new Set(decks.map((deck) => deck.join())).size).toBe(20);
  });
});

describe('the longest streak', () => {
  it('counts the most pairs found in a row', () => {
    expect(longestStreak([])).toBe(0);
    expect(longestStreak([false, false])).toBe(0);
    expect(longestStreak([true, false, true, true, true, false, true])).toBe(3);
  });
});
