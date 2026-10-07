import type { Page } from '@playwright/test';
import { ANSWERS, markGuess } from '../../shared/daily-word.js';
import type { DailyWordMark } from '../../shared/wire-types.js';
import { expect, labelsIn } from '../fixtures';

/** Playing Daily Word as a player does: by the marks the tiles' labels read. */

const MARKS: Readonly<Record<string, DailyWordMark>> = {
  'right place': 'correct',
  'in the word, somewhere else': 'present',
  'not in the word': 'absent',
};

const TILE = /^([A-Z]), (.+)$/;

export interface Guessed {
  word: string;
  marks: DailyWordMark[];
}

/** The guesses on the player's own board, as its tiles read. */
export async function guessesOf(page: Page): Promise<Guessed[]> {
  const labels = await labelsIn(
    page.getByRole('group', { name: 'Your guesses' }),
    '[role="img"]',
  );
  const tiles = labels.flatMap((label) => {
    const match = TILE.exec(label);
    return match && match[2] in MARKS
      ? [{ letter: match[1], mark: MARKS[match[2]] }]
      : [];
  });
  const rows: Guessed[] = [];
  for (let at = 0; at + 5 <= tiles.length; at += 5) {
    const row = tiles.slice(at, at + 5);
    rows.push({
      word: row.map((tile) => tile.letter.toLowerCase()).join(''),
      marks: row.map((tile) => tile.mark),
    });
  }
  return rows;
}

export const isFound = (guesses: readonly Guessed[]) =>
  guesses.some(({ marks }) => marks.every((mark) => mark === 'correct'));

const same = (a: readonly string[], b: readonly string[]) =>
  a.every((mark, index) => mark === b[index]);

/**
 * A good next guess: one of the answers every mark so far allows, picked to
 * split the rest into as many different mark patterns as it can.
 */
export function nextGuess(guesses: readonly Guessed[]): string {
  if (guesses.length === 0) return 'slate';
  const left = ANSWERS.filter((answer) =>
    guesses.every(({ word, marks }) => same(markGuess(word, answer), marks)),
  );
  let best = left[0];
  let bestSplit = 0;
  for (const word of left) {
    const split = new Set(left.map((answer) => markGuess(word, answer).join()))
      .size;
    if (split > bestSplit) [best, bestSplit] = [word, split];
  }
  return best;
}

/** Types a word and presses Enter, as a player at a keyboard does. */
export async function typeGuess(page: Page, word: string) {
  await page.keyboard.type(word);
  await page.keyboard.press('Enter');
}

/**
 * Guesses until the word is found or the guesses run out. In a room, the last
 * player's last guess ends the word at once and the reveal replaces the
 * board; what was seen until then comes back, without that guess.
 */
export async function solve(page: Page): Promise<Guessed[]> {
  const board = page.getByRole('group', { name: 'Your guesses' });
  // The board is up, so its keys are listened for.
  await expect(board).toBeVisible();
  let guesses = await guessesOf(page);
  while (guesses.length < 6 && !isFound(guesses)) {
    const count = guesses.length;
    await typeGuess(page, nextGuess(guesses));
    await expect
      .poll(
        async () =>
          !(await board.isVisible()) || (await guessesOf(page)).length > count,
      )
      .toBe(true);
    if (!(await board.isVisible())) break;
    guesses = await guessesOf(page);
  }
  return guesses;
}
