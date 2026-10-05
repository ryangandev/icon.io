import type { DailyWordMark } from '../../../../shared/wire-types';
import {
  checkGuess,
  markGuess,
  MAX_GUESSES,
  WORD_LENGTH,
  type GuessProblem,
} from '../../../../shared/daily-word';

/**
 * A word on your own, the daily one or a practice one, in the browser. Every
 * function returns a new game and leaves the one it was given alone, so React
 * state can hold it as is. The rules are in docs/games/daily-word.md.
 */
export interface SoloGame {
  answer: string;
  /** Guesses made, first first, lowercase. */
  guesses: readonly string[];
  /** The row being typed. */
  typed: string;
  /** Why the last Enter was turned back, until the row changes. */
  problem: GuessProblem | null;
}

export interface SoloRow {
  word: string;
  marks: DailyWordMark[];
}

export const newGame = (
  answer: string,
  guesses: readonly string[] = [],
): SoloGame => ({ answer, guesses, typed: '', problem: null });

export const rowsOf = (game: SoloGame): SoloRow[] =>
  game.guesses.map((word) => ({ word, marks: markGuess(word, game.answer) }));

export const isWon = (game: SoloGame): boolean =>
  game.guesses.at(-1) === game.answer;

export const isOver = (game: SoloGame): boolean =>
  isWon(game) || game.guesses.length >= MAX_GUESSES;

/** A letter typed into the next empty tile; ignored on a full row. */
export function typeLetter(game: SoloGame, letter: string): SoloGame {
  if (isOver(game) || game.typed.length >= WORD_LENGTH) return game;
  if (!/^[a-z]$/i.test(letter)) return game;
  return { ...game, typed: game.typed + letter.toLowerCase(), problem: null };
}

export function deleteLetter(game: SoloGame): SoloGame {
  if (isOver(game) || game.typed === '') return game;
  return { ...game, typed: game.typed.slice(0, -1), problem: null };
}

/**
 * Enter: the typed row becomes a guess, or is turned back with the reason and
 * stays as typed, costing nothing.
 */
export function submit(game: SoloGame): SoloGame {
  if (isOver(game)) return game;
  const problem = checkGuess(game.typed, game.guesses);
  if (problem) return { ...game, problem };
  return {
    ...game,
    guesses: [...game.guesses, game.typed],
    typed: '',
    problem: null,
  };
}

/** How many guesses a finished game took; null when it was missed. */
export const guessesToWin = (game: SoloGame): number | null =>
  isWon(game) ? game.guesses.length : null;
