import { describe, expect, it } from 'vitest';
import { isRaise, rollDice, type Bid } from '../../../../shared/liars-dice';
import { seededRandom } from '../../../../shared/seed';
import {
  botMove,
  chanceAtLeast,
  chanceOf,
  holding,
  newStyle,
  type BotStyle,
  type BotView,
} from './bot';

/** A bot that never bluffs, and one that always does. */
const never = () => 0.99;
const always = () => 0;
const STEADY: BotStyle = { callBelow: 0.4, bluff: 0.2 };

describe('the odds a bot plays by', () => {
  it('is the binomial tail with a chance of 1 in 3 a die', () => {
    expect(chanceAtLeast(0, 9)).toBe(1);
    expect(chanceAtLeast(10, 9)).toBe(0);
    expect(chanceAtLeast(1, 1)).toBeCloseTo(1 / 3);
    expect(chanceAtLeast(1, 2)).toBeCloseTo(5 / 9);
    expect(chanceAtLeast(2, 2)).toBeCloseTo(1 / 9);
    expect(chanceAtLeast(3, 9)).toBeCloseTo(0.6228, 3);
  });

  it('counts its own dice, wild ones included, before guessing the rest', () => {
    expect(holding([4, 4, 1], 4)).toBe(3);
    expect(holding([4, 4, 1], 5)).toBe(1);
    // LD02: Maya holds three 4s, so three 4s on the table is certain.
    expect(chanceOf({ count: 3, face: 4 }, [4, 4, 1], 12)).toBe(1);
    expect(chanceOf({ count: 4, face: 4 }, [4, 4, 1], 12)).toBeCloseTo(
      chanceAtLeast(1, 9),
    );
  });

  it('draws a style between bold and careful', () => {
    expect(newStyle(() => 0)).toEqual({ callBelow: 0.3, bluff: 0.2 });
    expect(newStyle(() => 0.999).callBelow).toBeCloseTo(0.45, 2);
  });
});

describe('a bot on its turn', () => {
  it('opens honestly on the face it holds most of, one short of what it believes', () => {
    const view: BotView = { dice: [4, 4, 1], diceOnTable: 12, bid: null };
    // Three 4s in hand and about three more among the nine it cannot see:
    // it believes six, and bids five.
    expect(botMove(view, STEADY, never)).toEqual({
      kind: 'bid',
      bid: { count: 5, face: 4 },
    });
  });

  it('calls Liar on a bid it finds unlikely', () => {
    const view: BotView = {
      dice: [2, 3, 6],
      diceOnTable: 12,
      bid: { count: 6, face: 5 },
    };
    expect(chanceOf(view.bid!, view.dice, view.diceOnTable)).toBeLessThan(0.3);
    expect(botMove(view, STEADY, never)).toEqual({ kind: 'call' });
  });

  it('raises on a bid it believes rather than calling it', () => {
    const view: BotView = {
      dice: [5, 5, 1],
      diceOnTable: 12,
      bid: { count: 4, face: 5 },
    };
    const move = botMove(view, STEADY, never);
    expect(move.kind).toBe('bid');
  });

  it('bluffs on a face it holds none of, at about a third of the table', () => {
    const view: BotView = { dice: [4, 4, 1], diceOnTable: 12, bid: null };
    const move = botMove(view, STEADY, always);
    expect(move).toEqual({ kind: 'bid', bid: { count: 4, face: 2 } });
  });

  it('a bolder bot raises past a doubtful bid that a careful one calls', () => {
    const view: BotView = {
      dice: [6, 6, 1],
      diceOnTable: 12,
      bid: { count: 5, face: 5 },
    };
    const chance = chanceOf(view.bid!, view.dice, view.diceOnTable);
    expect(chance).toBeGreaterThan(0.3);
    expect(chance).toBeLessThan(0.45);
    expect(botMove(view, { callBelow: 0.45, bluff: 0 }, never)).toEqual({
      kind: 'call',
    });
    expect(botMove(view, { callBelow: 0.3, bluff: 0 }, never)).toEqual({
      kind: 'bid',
      bid: { count: 5, face: 6 },
    });
  });

  it('can only call when no raise is left', () => {
    const view: BotView = {
      dice: [6, 6],
      diceOnTable: 4,
      bid: { count: 4, face: 6 },
    };
    expect(botMove(view, { callBelow: 0, bluff: 1 }, always)).toEqual({
      kind: 'call',
    });
  });

  it('always makes a legal move, and never calls with no bid to call', () => {
    const random = seededRandom(42);
    const illegal: string[] = [];
    for (let game = 0; game < 300; game++) {
      const diceOnTable = 2 + Math.floor(random() * 29);
      const dice = rollDice(1 + Math.floor(random() * 5), random).slice(
        0,
        diceOnTable,
      );
      let bid: Bid | null = null;
      for (let turn = 0; turn < 40; turn++) {
        const move = botMove(
          { dice, diceOnTable, bid },
          newStyle(random),
          random,
        );
        const legal =
          move.kind === 'call'
            ? bid !== null
            : isRaise(move.bid, bid, diceOnTable);
        if (!legal)
          illegal.push(JSON.stringify({ dice, diceOnTable, bid, move }));
        if (move.kind === 'call') break;
        bid = move.bid;
      }
    }
    expect(illegal).toEqual([]);
  });
});
