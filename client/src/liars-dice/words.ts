import { bidWords, numberWord, type Bid } from '../../../shared/liars-dice';
import type { LiarsDiceReveal } from '../../../shared/wire-types';
import { plural } from '../games/plural';

/** "1 die", "3 dice". */
export const diceWord = (count: number) => plural(count, 'die', 'dice');

/** How a sentence names a player: "you", or by name. */
export interface Who {
  /** "Leo", "you". */
  name: string;
  /** "Leo’s", "your". */
  possessive: string;
  you: boolean;
}

export const capital = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

/** Turns a player id into how sentences name them. */
export type Naming = (playerId: string) => Who;

export function naming(
  youId: string,
  nameOf: (playerId: string) => string,
): Naming {
  return (playerId) =>
    playerId === youId
      ? { name: 'you', possessive: 'your', you: true }
      : {
          name: nameOf(playerId),
          possessive: `${nameOf(playerId)}’s`,
          you: false,
        };
}

/** "Leo bid five 5s", "You bid one 2". */
export const bidLine = (who: Who, bid: Bid) =>
  `${capital(who.name)} bid ${bidWords(bid)}`;

/** "incl. 2 wild ones · bid was five". */
export function countDetail(reveal: LiarsDiceReveal): string {
  const wild =
    reveal.wild === 0
      ? 'no wild ones'
      : reveal.wild === 1
        ? 'incl. 1 wild one'
        : `incl. ${reveal.wild} wild ones`;
  return `${wild} · bid was ${numberWord(reveal.bid.count)}`;
}

/** Whether the bid called held up. */
export const stood = (reveal: LiarsDiceReveal) =>
  reveal.matched >= reveal.bid.count;

/** "Sam loses a die", "you are out": the start of a sentence is the caller's to capitalise. */
export function lossLine(reveal: LiarsDiceReveal, who: Naming): string {
  const loser = who(reveal.loserId);
  return reveal.out
    ? `${loser.name} ${loser.you ? 'are' : 'is'} out`
    : `${loser.name} ${loser.you ? 'lose' : 'loses'} a die`;
}

/** After the count: "Leo’s bid stands", "a lie, so Sam is out". */
export function verdict(reveal: LiarsDiceReveal, who: Naming): string {
  return stood(reveal)
    ? `${capital(who(reveal.bid.playerId).possessive)} bid stands`
    : `a lie, so ${lossLine(reveal, who)}`;
}

/** The turn bar over a reveal. */
export function revealBar(reveal: LiarsDiceReveal, who: Naming) {
  const bidder = who(reveal.bid.playerId);
  return {
    label: `${capital(who(reveal.callerId).name)} called Liar`,
    main: stood(reveal)
      ? `${capital(bidder.possessive)} bid stands`
      : `${capital(bidder.possessive)} bid was a lie`,
    meta: capital(lossLine(reveal, who)),
  };
}
