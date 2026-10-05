import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../../../shared/seed';
import {
  BOT_NAMES,
  bid,
  call,
  currentBid,
  diceOnTable,
  isBotTurn,
  isYourTurn,
  newGame,
  nextRound,
  placeOf,
  playBot,
  seatsIn,
  YOU,
  youWon,
  type SoloGame,
} from './game';

/** A table with these dice, in this order, `turnId` to move. */
function table(
  cups: Record<string, number[]>,
  turnId: string,
  round = 1,
): SoloGame {
  return {
    dicePerPlayer: 3,
    seats: Object.entries(cups).map(([id, dice]) => ({
      id,
      diceLeft: dice.length,
      dice,
      style: id === YOU ? null : { callBelow: 0.4, bluff: 0 },
      outInRound: null,
    })),
    round,
    phase: 'bidding',
    bids: [],
    turnId,
    reveal: null,
  };
}

const diceLeft = (game: SoloGame, id: string) =>
  game.seats.find((seat) => seat.id === id)?.diceLeft;

describe('a new table', () => {
  it('seats you and the bots picked, each with their dice rolled', () => {
    const game = newGame({ bots: 3, dicePerPlayer: 5 }, seededRandom(3));
    expect(game.seats).toHaveLength(4);
    expect(game.seats.map((seat) => seat.id)).toContain(YOU);
    for (const seat of game.seats) {
      expect(seat.dice).toHaveLength(5);
      expect(seat.id === YOU || BOT_NAMES.includes(seat.id as never)).toBe(
        true,
      );
    }
    expect(new Set(game.seats.map((seat) => seat.id)).size).toBe(4);
    expect(game).toMatchObject({ round: 1, phase: 'bidding', bids: [] });
    expect(game.seats.map((seat) => seat.id)).toContain(game.turnId);
    expect(diceOnTable(game)).toBe(20);
  });

  it('gives you no style and every bot one', () => {
    const game = newGame({ bots: 5, dicePerPlayer: 3 }, seededRandom(9));
    for (const seat of game.seats) {
      expect(seat.style === null).toBe(seat.id === YOU);
    }
  });
});

// LD04: Maya (you) [4, 4, 1], Pip [5, 2, 6], Juno [5, 1, 3], Otto [5, 5, 2].
const ld04 = () =>
  table(
    { [YOU]: [4, 4, 1], Pip: [5, 2, 6], Juno: [5, 1, 3], Otto: [5, 5, 2] },
    YOU,
  );

describe('the bidding', () => {
  it('passes the turn on with every raise, and ignores anything else', () => {
    let game = bid(ld04(), YOU, { count: 3, face: 4 });
    expect(currentBid(game)).toEqual({ playerId: YOU, count: 3, face: 4 });
    expect(game.turnId).toBe('Pip');
    expect(isBotTurn(game)).toBe(true);
    expect(bid(game, YOU, { count: 4, face: 4 })).toBe(game);
    expect(bid(game, 'Pip', { count: 3, face: 3 })).toBe(game);
    expect(bid(game, 'Pip', { count: 13, face: 2 })).toBe(game);
    game = bid(game, 'Pip', { count: 3, face: 5 });
    expect(game.turnId).toBe('Juno');
  });

  it('cannot call Liar with no bid yet', () => {
    const game = ld04();
    expect(call(game, YOU)).toBe(game);
  });

  it('settles a call on a bid that stands against the caller', () => {
    let game = ld04();
    for (const [id, count, face] of [
      [YOU, 3, 4],
      ['Pip', 3, 5],
      ['Juno', 4, 5],
      ['Otto', 5, 5],
    ] as const) {
      game = bid(game, id, { count, face });
    }
    expect(isYourTurn(game)).toBe(true);
    game = call(game, YOU);
    expect(game.phase).toBe('reveal');
    expect(game.reveal).toEqual({
      bid: { playerId: 'Otto', count: 5, face: 5 },
      callerId: YOU,
      matched: 6,
      wild: 2,
      loserId: YOU,
      out: false,
    });
    expect(diceLeft(game, YOU)).toBe(2);
    expect(game.turnId).toBeNull();
  });

  it('takes a die from the bidder when the bid was a lie, and they open next', () => {
    let game = bid(ld04(), YOU, { count: 7, face: 4 });
    game = call(game, 'Pip');
    expect(game.reveal).toMatchObject({ matched: 4, loserId: YOU });
    game = nextRound(game, seededRandom(1));
    expect(game).toMatchObject({ round: 2, phase: 'bidding', bids: [] });
    expect(game.turnId).toBe(YOU);
    expect(game.reveal).toBeNull();
    expect(diceOnTable(game)).toBe(11);
    expect(game.seats.find((seat) => seat.id === YOU)?.dice).toHaveLength(2);
  });
});

describe('going out', () => {
  it('passes the opening to the next player still in', () => {
    let game = table({ [YOU]: [2, 3], Pip: [6], Juno: [4, 4] }, 'Pip', 4);
    game = bid(game, 'Pip', { count: 2, face: 6 });
    game = bid(game, 'Juno', { count: 3, face: 6 });
    game = call(game, YOU);
    expect(game.reveal).toMatchObject({ loserId: 'Juno', out: false });
    game = nextRound(game, seededRandom(2));
    game = bid(game, 'Juno', { count: 1, face: 5 });
    game = bid(game, YOU, { count: 4, face: 5 });
    game = call(game, 'Pip');
    // You bid four 5s on four dice: you lose one, and Pip is still in.
    game = nextRound(game, seededRandom(3));
    expect(game.turnId).toBe(YOU);
  });

  it('ends the game for you when you lose your last die', () => {
    let game = table(
      { [YOU]: [3], Pip: [5, 5], Juno: [2, 2], Otto: [6, 6] },
      YOU,
      7,
    );
    game = bid(game, YOU, { count: 3, face: 3 });
    game = call(game, 'Pip');
    expect(game.phase).toBe('over');
    expect(game.reveal).toMatchObject({ loserId: YOU, out: true });
    expect(youWon(game)).toBe(false);
    expect(placeOf(game)).toEqual({ place: 4, of: 4 });
    expect(game.seats.find((seat) => seat.id === YOU)?.outInRound).toBe(7);
    expect(nextRound(game, seededRandom(1))).toBe(game);
  });

  it('is a win when you are the last player in', () => {
    let game = table({ [YOU]: [4, 3], Otto: [2] }, 'Otto', 10);
    game = bid(game, 'Otto', { count: 2, face: 2 });
    game = call(game, YOU);
    expect(game.phase).toBe('over');
    expect(youWon(game)).toBe(true);
    expect(placeOf(game)).toEqual({ place: 1, of: 2 });
    expect(seatsIn(game).map((seat) => seat.id)).toEqual([YOU]);
  });

  it('places you behind everybody still in', () => {
    let game = table(
      { [YOU]: [6], Pip: [], Juno: [2, 2], Otto: [3, 3] },
      'Juno',
      8,
    );
    game = bid(game, 'Juno', { count: 2, face: 6 });
    game = bid(game, 'Otto', { count: 3, face: 6 });
    game = call(game, YOU);
    expect(game.reveal).toMatchObject({ loserId: 'Otto' });
    game = nextRound(game, seededRandom(4));
    game = bid(game, 'Otto', { count: 1, face: 2 });
    game = bid(game, YOU, { count: 4, face: 6 });
    game = call(game, 'Juno');
    expect(game.phase).toBe('over');
    expect(placeOf(game)).toEqual({ place: 3, of: 4 });
  });
});

describe('the bots', () => {
  it('play a whole game to its end, every move legal', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const random = seededRandom(seed);
      let game = newGame({ bots: 5, dicePerPlayer: 5 }, random);
      let moves = 0;
      let stuck = 0;
      while (game.phase !== 'over' && moves < 5000) {
        if (game.phase === 'reveal') game = nextRound(game, random);
        else if (isYourTurn(game)) {
          // You call whenever you can, and otherwise open as low as you may.
          game = currentBid(game)
            ? call(game, YOU)
            : bid(game, YOU, { count: 1, face: 2 });
        } else {
          const before = game;
          game = playBot(game, random);
          if (game === before) stuck += 1;
        }
        moves += 1;
      }
      expect({ phase: game.phase, stuck }).toEqual({
        phase: 'over',
        stuck: 0,
      });
    }
  });
});
