import type { Page } from '@playwright/test';
import { expect } from '../fixtures';

/** Playing Hush as a player does: by the cards each one sees. */

/** The cards in `page`'s hand, lowest first. */
export async function handOf(page: Page): Promise<number[]> {
  const cards = await page
    .getByRole('region', { name: 'Your hand' })
    .getByRole('img')
    .allTextContents();
  return cards.map(Number);
}

/** Each of `pages` presses Ready, in order. */
export async function pressReady(pages: readonly Page[]) {
  for (const page of pages) {
    await page.getByRole('button', { name: 'I’m ready' }).click();
  }
}

/** Everybody presses Ready, and the level opens after its countdown. */
export async function readyUp(pages: readonly Page[]) {
  await pressReady(pages);
  // Every hand is dealt; play opens for whoever holds the lowest card.
  for (const page of pages) {
    await expect(page.getByRole('region', { name: 'Your hand' })).toBeVisible();
  }
}

/** Every card held, lowest first, with the page that holds it. */
export async function deal(pages: readonly Page[]) {
  const held = await Promise.all(
    pages.map(async (page) =>
      (await handOf(page)).map((card) => ({ page, card })),
    ),
  );
  return held.flat().toSorted((a, b) => a.card - b.card);
}

/**
 * `page` plays `card`, once play has opened and it is their lowest, and
 * everybody sees it land on top of the pile.
 */
export async function play(page: Page, card: number, pages: readonly Page[]) {
  // A real hand, not a burst.
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: `Play ${card}` }).click();
  for (const seen of pages) {
    await expect(
      seen
        .getByRole('region', { name: 'The pile' })
        .getByRole('img', { name: String(card), exact: true })
        .first(),
    ).toBeVisible();
  }
}
