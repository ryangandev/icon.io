import type { Page } from '@playwright/test';
import {
  combine,
  dealtCards,
  isTarget,
  OPERATORS,
  type Card,
  type Operator,
  type Step,
} from '../../shared/make-24.js';
import { expect } from '../fixtures';

/** Playing Make 24 as a player does: by the cards and signs on the table. */

export const SIGNS: Readonly<Record<Operator, string>> = {
  '+': 'plus',
  '-': 'minus',
  '*': 'times',
  '/': 'divided by',
};

/** Steps that make 24 from `cards`, found the long way. */
export function stepsToSolve(cards: readonly Card[]): Step[] | null {
  if (cards.length === 1) return isTarget(cards[0].value) ? [] : null;
  for (let left = 0; left < cards.length; left++) {
    for (let right = 0; right < cards.length; right++) {
      for (const op of OPERATORS) {
        const step = { left, op, right };
        const next = left === right ? null : combine(cards, step);
        const rest = next && stepsToSolve(next);
        if (rest) return [step, ...rest];
      }
    }
  }
  return null;
}

/** The cards on the table: the toggles that are not signs. */
export const cardsOn = (page: Page) =>
  page.locator(
    'xpath=//button[@aria-pressed][not(ancestor::*[@aria-label="Signs"])]',
  );

/** Reads the hand dealt, then makes 24 from it a card and a sign at a time. */
export async function solveHand(page: Page) {
  const cards = cardsOn(page);
  await expect(cards).toHaveCount(4);
  const deal = (await cards.allTextContents()).map(Number);
  const steps = stepsToSolve(dealtCards(deal));
  expect(steps, `a way to make 24 from ${deal.join(' ')}`).not.toBeNull();
  for (const step of steps!) {
    await cards.nth(step.left).click();
    await page.getByRole('button', { name: SIGNS[step.op] }).click();
    await cards.nth(step.right).click();
  }
}
