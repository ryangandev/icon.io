import type { Bid } from '../../../shared/liars-dice';
import type { LiarsDiceReveal } from '../../../shared/wire-types';
import type { Messages } from '../i18n';

/** A player's name and possessive in the reader's language. */
export interface Who {
  name: string;
  possessive: string;
  you: boolean;
}

/** Turns a player id into how sentences name them. */
export type Naming = (playerId: string) => Who;

export function naming(
  youId: string,
  nameOf: (playerId: string) => string,
  m: Messages,
): Naming {
  return (playerId) => {
    const you = playerId === youId;
    const name = you ? m.liarsDice.you : nameOf(playerId);
    return { name, possessive: m.liarsDice.possessive(name, you), you };
  };
}

export const diceWord = (count: number, m: Messages) => m.liarsDice.dice(count);
export const bidLine = (who: Who, bid: Bid, m: Messages) =>
  m.liarsDice.bidLine(who, bid);
export const countDetail = (reveal: LiarsDiceReveal, m: Messages) =>
  m.liarsDice.countDetail(reveal);

/** Whether the bid called held up. */
export const stood = (reveal: LiarsDiceReveal) =>
  reveal.matched >= reveal.bid.count;

export const lossLine = (reveal: LiarsDiceReveal, who: Naming, m: Messages) =>
  m.liarsDice.lossLine(reveal, who);
export const verdict = (reveal: LiarsDiceReveal, who: Naming, m: Messages) =>
  m.liarsDice.verdict(reveal, who);
export const revealBar = (reveal: LiarsDiceReveal, who: Naming, m: Messages) =>
  m.liarsDice.revealBar(reveal, who);
