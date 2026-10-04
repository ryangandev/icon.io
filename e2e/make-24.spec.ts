import type { Page } from '@playwright/test';
import {
  combine,
  dealtCards,
  isTarget,
  OPERATORS,
  type Card,
  type Operator,
  type Step,
} from '../shared/make-24.js';
import { createRoom, expect, joinRoom, test } from './fixtures';

const SIGNS: Readonly<Record<Operator, string>> = {
  '+': 'plus',
  '-': 'minus',
  '*': 'times',
  '/': 'divided by',
};

/** Steps that make 24 from `cards`, found the long way. */
function stepsToSolve(cards: readonly Card[]): Step[] | null {
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
const cardsOn = (page: Page) =>
  page.locator(
    'xpath=//button[@aria-pressed][not(ancestor::*[@aria-label="Signs"])]',
  );

/** Reads the hand dealt, then makes 24 from it a card and a sign at a time. */
async function solveHand(page: Page) {
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

test('two players solve every hand of a game', async ({ player }) => {
  test.setTimeout(120_000);
  const maya = await player('Maya');
  const leo = await player('Leo');
  await joinRoom(leo, await createRoom(maya, 'make-24'));
  await maya.getByRole('button', { name: 'Start game' }).click();

  for (let hand = 1; hand <= 5; hand++) {
    for (const page of [maya, leo]) {
      const turn = page.getByRole('region', { name: 'Turn' });
      await expect(turn.getByText(`Hand ${hand} of 5`)).toBeVisible();
      await expect(turn.getByText('Make 24')).toBeVisible();
    }
    // Maya first, and she waits for Leo; Leo's solve ends the hand.
    await solveHand(maya);
    await expect(
      maya.getByRole('region', { name: 'Turn' }).getByText('Waiting for Leo'),
    ).toBeVisible();
    await solveHand(leo);
    // Everybody solved it, so the hand ends early, with its results.
    await expect(maya.getByText(`Hand ${hand} results`).first()).toBeVisible();
  }

  await expect(maya.getByText('Game over', { exact: true })).toBeVisible();
  await expect(
    maya.getByRole('list', { name: 'Standings' }).getByRole('listitem'),
  ).toHaveCount(2);
});

test('a player with no name plays ten hands on their own', async ({
  player,
}) => {
  test.setTimeout(120_000);
  const sam = await player('Sam', { named: false });
  let sockets = 0;
  sam.on('websocket', () => sockets++);
  await sam.goto('/');
  await sam
    .getByRole('region', { name: 'Make 24' })
    .getByRole('link', { name: 'Play solo' })
    .click();
  await sam.getByRole('button', { name: 'Start' }).click();

  const turn = sam.getByRole('region', { name: 'Turn' });
  for (let hand = 1; hand <= 10; hand++) {
    await expect(turn.getByText(`Hand ${hand} of 10`)).toBeVisible();
    await solveHand(sam);
    // The last solve ends the run at once.
    if (hand < 10) await expect(turn.getByText('24! Nice.')).toBeVisible();
  }

  await expect(
    sam.getByRole('heading', { name: /^10 hands in / }),
  ).toBeVisible();
  await expect(
    sam.getByRole('button', { name: 'Challenge a friend' }).first(),
  ).toBeVisible();
  expect(sockets).toBe(0);
});
