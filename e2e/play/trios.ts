import type { Page } from '@playwright/test';
import { cardName, DECK_SIZE, findTrios, isTrio } from '../../shared/trios.js';
import { expect } from '../fixtures';

/** Playing Trios as a player does: by what the cards' labels say. */

/** Every card's name, as its label starts: "Two blue striped triangles". */
const CARD_BY_NAME = new Map(
  Array.from({ length: DECK_SIZE }, (_, card) => [cardName(card), card]),
);

/** The cards on the table, place by place, read from their labels. */
export async function tableOf(page: Page): Promise<number[]> {
  const labels = await page
    .getByRole('group', { name: 'Table' })
    .locator(':scope > [aria-label]')
    .evaluateAll((cards) => cards.map((card) => card.ariaLabel ?? ''));
  return labels.map((label) => {
    const card = CARD_BY_NAME.get(label.split(',')[0]);
    if (card === undefined) throw new Error(`No card is called "${label}"`);
    return card;
  });
}

/** Picks the cards at `places`, one at a time, as a hand does. */
export async function pickPlaces(page: Page, places: readonly number[]) {
  const cards = page
    .getByRole('group', { name: 'Table' })
    .locator(':scope > [aria-label]');
  for (const place of places) await cards.nth(place).click();
}

/** Picks a trio on the table and returns its cards. */
export async function pickTrio(page: Page): Promise<number[]> {
  const table = await tableOf(page);
  const [trio] = findTrios(table);
  await pickPlaces(page, trio);
  return trio.map((place) => table[place]);
}

/** Picks three cards that are not a trio, and returns their places. */
export async function pickMiss(page: Page): Promise<number[]> {
  const table = await tableOf(page);
  const miss = [2, 3].find(
    (third) => !isTrio(table[0], table[1], table[third]),
  )!;
  await pickPlaces(page, [0, 1, miss]);
  return [0, 1, miss];
}

/** The turn bar, which says what to do and what just happened. */
export const turnOf = (page: Page) =>
  page.getByRole('region', { name: 'Turn' });

/** Waits until the player can pick again: every card on the table takes a pick. */
export async function readyToFind(page: Page) {
  await expect(
    page.getByRole('group', { name: 'Table' }).getByRole('button'),
  ).toHaveCount(12);
}
