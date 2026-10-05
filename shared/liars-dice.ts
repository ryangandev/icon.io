/**
 * Liar's Dice rules that a room on the server and a game against bots in the
 * browser both play by: the roll, the raise rule, and the count a call is
 * settled by. The rules are in docs/games/liars-dice.md.
 *
 * A die is a number from 1 to 6. Ones are wild: they count as whatever face is
 * bid, so nobody bids on them, and a bid's face is 2 to 6.
 */

/** How many dice each player starts a game with: the quick game, or the classic. */
export const DICE_PER_PLAYER = [3, 5] as const;
export type DicePerPlayer = (typeof DICE_PER_PLAYER)[number];

/** The faces a bid may name; ones are wild and never bid. */
export const BID_FACES = [2, 3, 4, 5, 6] as const;
export const LOWEST_FACE = 2;
export const HIGHEST_FACE = 6;
export const WILD = 1;

/** At least `count` dice on the whole table show `face`, ones included. */
export interface Bid {
  count: number;
  face: number;
}

/** The lowest bid there is, and the one made for a player who runs out of time with no bid yet. */
export const OPENING_BID: Readonly<Bid> = { count: 1, face: LOWEST_FACE };

export function isDicePerPlayer(value: unknown): value is DicePerPlayer {
  return DICE_PER_PLAYER.includes(value as DicePerPlayer);
}

/** `count` dice, each from 1 to 6. */
export function rollDice(count: number, random: () => number): number[] {
  return Array.from({ length: count }, () => 1 + Math.floor(random() * 6));
}

/** Whether a die counts towards a bid on `face`: it shows it, or it is a wild one. */
export function counts(die: number, face: number): boolean {
  return die === face || die === WILD;
}

/** A bid of a face from 2 to 6, and a count from 1 to the dice on the table. */
export function isValidBid(bid: Bid, diceOnTable: number): boolean {
  return (
    Number.isInteger(bid.count) &&
    Number.isInteger(bid.face) &&
    bid.face >= LOWEST_FACE &&
    bid.face <= HIGHEST_FACE &&
    bid.count >= 1 &&
    bid.count <= diceOnTable
  );
}

/** More dice of any face, or as many dice of a higher face. */
export function isHigher(bid: Bid, than: Bid): boolean {
  return (
    bid.count > than.count || (bid.count === than.count && bid.face > than.face)
  );
}

/** Whether `bid` may follow `previous` (null when it opens the round). */
export function isRaise(
  bid: Bid,
  previous: Bid | null,
  diceOnTable: number,
): boolean {
  return (
    isValidBid(bid, diceOnTable) &&
    (previous === null || isHigher(bid, previous))
  );
}

/**
 * The smallest bid that may follow `previous`, or null when there is none:
 * every die on the table showing 6 can only be called.
 */
export function smallestRaise(
  previous: Bid | null,
  diceOnTable: number,
): Bid | null {
  if (previous === null) {
    return diceOnTable > 0 ? { ...OPENING_BID } : null;
  }
  if (previous.face < HIGHEST_FACE) {
    return { count: previous.count, face: previous.face + 1 };
  }
  if (previous.count < diceOnTable) {
    return { count: previous.count + 1, face: LOWEST_FACE };
  }
  return null;
}

/**
 * The smallest count `face` may be bid at after `previous`: the same count
 * for a higher face, one more for any other.
 */
export function smallestCountFor(face: number, previous: Bid | null): number {
  if (previous === null) return 1;
  return face > previous.face ? previous.count : previous.count + 1;
}

/** What a call finds: the dice that count towards the bid, and how many of them are wild ones. */
export interface Count {
  matched: number;
  wild: number;
}

/** Counts every cup on the table against a bid's face. */
export function countFace(
  cups: readonly (readonly number[])[],
  face: number,
): Count {
  let matched = 0;
  let wild = 0;
  for (const cup of cups) {
    for (const die of cup) {
      if (!counts(die, face)) continue;
      matched += 1;
      if (die === WILD) wild += 1;
    }
  }
  return { matched, wild };
}

/** The bid stands when the table holds at least as many as it says; otherwise it was a lie. */
export function bidStands(bid: Bid, count: Count): boolean {
  return count.matched >= bid.count;
}

const NUMBER_WORDS = [
  'no',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
];

/** "one", "five"; past twelve, the digits. */
export function numberWord(count: number): string {
  return NUMBER_WORDS[count] ?? String(count);
}

/** "one 2", "four 5s": a bid as the chat and the screens say it. */
export function bidWords(bid: Bid): string {
  return `${numberWord(bid.count)} ${bid.face}${bid.count === 1 ? '' : 's'}`;
}
