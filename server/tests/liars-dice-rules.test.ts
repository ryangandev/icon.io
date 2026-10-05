import { describe, expect, it } from 'vitest';
import {
  bidStands,
  bidWords,
  countFace,
  counts,
  isDicePerPlayer,
  isHigher,
  isRaise,
  OPENING_BID,
  rollDice,
  smallestCountFor,
  smallestRaise,
} from '../../shared/liars-dice.js';
import { seededRandom } from '../../shared/seed.js';

describe('the roll', () => {
  it('rolls as many dice as asked, each from 1 to 6', () => {
    const dice = rollDice(600, seededRandom(7));
    expect(dice).toHaveLength(600);
    expect(new Set(dice)).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it('rolls the same dice from the same source', () => {
    expect(rollDice(5, seededRandom(1))).toEqual(rollDice(5, seededRandom(1)));
  });

  it('starts a game with 3 or 5 dice each, and nothing else', () => {
    expect([3, 5].every(isDicePerPlayer)).toBe(true);
    expect([0, 4, 6, '3', null].some(isDicePerPlayer)).toBe(false);
  });
});

describe('a raise', () => {
  it('is more dice of any face, or as many of a higher face', () => {
    const threeFives = { count: 3, face: 5 };
    expect(isHigher({ count: 3, face: 6 }, threeFives)).toBe(true);
    expect(isHigher({ count: 4, face: 2 }, threeFives)).toBe(true);
    expect(isHigher({ count: 3, face: 4 }, threeFives)).toBe(false);
    expect(isHigher({ count: 3, face: 5 }, threeFives)).toBe(false);
    expect(isHigher({ count: 2, face: 6 }, threeFives)).toBe(false);
  });

  it('opens with any face from 2 to 6 and any count from 1', () => {
    expect(isRaise({ count: 1, face: 2 }, null, 6)).toBe(true);
    expect(isRaise({ count: 6, face: 6 }, null, 6)).toBe(true);
    expect(isRaise({ count: 0, face: 3 }, null, 6)).toBe(false);
    expect(isRaise({ count: 2, face: 1 }, null, 6)).toBe(false);
    expect(isRaise({ count: 2, face: 7 }, null, 6)).toBe(false);
    expect(isRaise({ count: 1.5, face: 3 }, null, 6)).toBe(false);
  });

  it('never counts more dice than are on the table', () => {
    expect(isRaise({ count: 7, face: 2 }, { count: 6, face: 6 }, 6)).toBe(
      false,
    );
    expect(isRaise({ count: 7, face: 2 }, { count: 6, face: 6 }, 7)).toBe(true);
  });

  it('opens on the smallest raise, and has none past every die showing 6', () => {
    expect(smallestRaise(null, 10)).toEqual(OPENING_BID);
    expect(smallestRaise({ count: 5, face: 5 }, 10)).toEqual({
      count: 5,
      face: 6,
    });
    expect(smallestRaise({ count: 5, face: 6 }, 10)).toEqual({
      count: 6,
      face: 2,
    });
    expect(smallestRaise({ count: 10, face: 6 }, 10)).toBeNull();
  });

  it('knows the smallest count each face may be bid at', () => {
    const previous = { count: 4, face: 4 };
    expect(smallestCountFor(5, previous)).toBe(4);
    expect(smallestCountFor(4, previous)).toBe(5);
    expect(smallestCountFor(2, previous)).toBe(5);
    expect(smallestCountFor(3, null)).toBe(1);
  });
});

describe('a call', () => {
  it('counts ones as wild', () => {
    expect(counts(5, 5)).toBe(true);
    expect(counts(1, 5)).toBe(true);
    expect(counts(4, 5)).toBe(false);
  });

  it('counts every cup against the face, marking the wild ones', () => {
    // LD10: Sam [5, 1], Maya [3, 5, 6], Ryan [2, 2], Leo [5, 4, 1].
    const cups = [
      [5, 1],
      [3, 5, 6],
      [2, 2],
      [5, 4, 1],
    ];
    expect(countFace(cups, 5)).toEqual({ matched: 5, wild: 2 });
    expect(countFace(cups, 2)).toEqual({ matched: 4, wild: 2 });
  });

  it('lets a bid stand when the table holds at least as many', () => {
    const count = { matched: 5, wild: 2 };
    expect(bidStands({ count: 5, face: 5 }, count)).toBe(true);
    expect(bidStands({ count: 4, face: 5 }, count)).toBe(true);
    expect(bidStands({ count: 6, face: 5 }, count)).toBe(false);
  });
});

describe('the words for a bid', () => {
  it('reads as the chat says it', () => {
    expect(bidWords({ count: 1, face: 2 })).toBe('one 2');
    expect(bidWords({ count: 4, face: 5 })).toBe('four 5s');
    expect(bidWords({ count: 14, face: 6 })).toBe('14 6s');
  });
});
