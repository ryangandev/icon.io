import type { Page } from '@playwright/test';
import { createRoom, expect, joinRoom, test } from './fixtures';

interface CardSeen {
  place: string;
  /** "Ring Sky", or null while face down. */
  symbol: string | null;
  matched: boolean;
}

const LABEL = /^(Row \d+, column \d+): (.+?)(, matched)?$/;

/** Every card on the board, as its label reads. */
async function boardOf(page: Page): Promise<CardSeen[]> {
  const labels = await page
    .getByRole('grid', { name: 'Cards' })
    .locator('[aria-label^="Row "]')
    .evaluateAll((cards) => cards.map((card) => card.ariaLabel ?? ''));
  return labels.map((label) => {
    const [, place, symbol, matched] = LABEL.exec(label)!;
    return {
      place,
      symbol: symbol === 'face down' ? null : symbol,
      matched: Boolean(matched),
    };
  });
}

/**
 * What a good player remembers: the symbol at every place they have seen
 * turned over, by anybody.
 */
type Memory = Map<string, string>;

async function remember(page: Page, memory: Memory) {
  for (const card of await boardOf(page)) {
    if (card.symbol) memory.set(card.place, card.symbol);
  }
}

/** Turns over the card at `place` and returns its symbol. */
async function flip(page: Page, place: string, memory: Memory) {
  // A real hand, not a burst: the server takes a few cards a second.
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: `${place}: face down` }).click();
  const shown = page.getByLabel(new RegExp(`^${place}: (?!face down)`));
  await expect(shown).toHaveCount(1);
  await remember(page, memory);
  return memory.get(place)!;
}

/** Two cards: a pair remembered, or something new and its partner if known. */
async function playTurn(page: Page, memory: Memory) {
  await remember(page, memory);
  const down = (await boardOf(page)).filter((card) => !card.symbol);
  const known = down.filter((card) => memory.has(card.place));
  const unseen = down.filter((card) => !memory.has(card.place));
  const pair = known.find((card) =>
    known.some(
      (other) =>
        other !== card && memory.get(other.place) === memory.get(card.place),
    ),
  );
  const first = (pair ?? unseen[0] ?? down[0]).place;
  const symbol = await flip(page, first, memory);
  const partner =
    down.find(
      (card) => card.place !== first && memory.get(card.place) === symbol,
    ) ??
    unseen.find((card) => card.place !== first) ??
    down.find((card) => card.place !== first)!;
  await flip(page, partner.place, memory);
}

/** Told to flip a card: their turn, with nothing up yet. */
const yourTurn = (page: Page) =>
  page.getByRole('region', { name: 'Turn' }).getByText('Flip a card');

/** The player told to flip a card, if anybody is. */
async function whoseTurn(pages: readonly Page[]): Promise<Page | null> {
  for (const page of pages) {
    if (await yourTurn(page).isVisible()) return page;
  }
  return null;
}

test('two players take turns until every pair is found', async ({ player }) => {
  test.setTimeout(180_000);
  const maya = await player('Maya');
  const leo = await player('Leo');
  await joinRoom(leo, await createRoom(maya, 'pairs', { seats: 2 }));
  await maya.getByRole('button', { name: 'Start game' }).click();
  await expect(maya.getByText('0 of 8 pairs')).toBeVisible();

  const memory: Memory = new Map();
  const over = maya.getByText('Game over', { exact: true });
  while (!(await over.isVisible())) {
    // Whoever is told to flip a card; a miss shows first, then passes on.
    await expect
      .poll(
        async () => (await whoseTurn([maya, leo])) !== null || over.isVisible(),
      )
      .toBe(true);
    const mover = await whoseTurn([maya, leo]);
    if (!mover) break;
    const watcher = mover === maya ? leo : maya;
    await playTurn(mover, memory);
    if (
      await mover
        .getByRole('region', { name: 'Turn' })
        .getByText('Not a pair')
        .isVisible()
    ) {
      // The other player saw both cards, and is told they are next.
      await expect(
        watcher.getByRole('region', { name: 'Turn' }).getByText(/You’re next/),
      ).toBeVisible();
    }
  }

  await expect(maya.getByRole('heading', { name: / pairs?\.$/ })).toBeVisible();
  await expect(
    maya.getByRole('list', { name: 'Standings' }).getByRole('listitem'),
  ).toHaveCount(2);
  // The finished board stays up, every card matched.
  expect(
    (await boardOf(maya)).every((card) => card.matched && card.symbol),
  ).toBe(true);
  await expect(maya.getByRole('gridcell')).toHaveCount(16);
});

test('a player with no name clears a board on their own', async ({
  player,
}) => {
  const sam = await player('Sam', { named: false });
  let sockets = 0;
  sam.on('websocket', () => sockets++);
  await sam.goto('/');
  await sam
    .getByRole('region', { name: 'Pairs' })
    .getByRole('link', { name: 'Play solo' })
    .click();
  await sam.getByRole('radio', { name: /Small/ }).click();
  await sam.getByRole('button', { name: 'Start' }).click();

  const memory: Memory = new Map();
  const cleared = sam.getByRole('heading', {
    name: /^8 pairs in \d+ turns\.$/,
  });
  while (!(await cleared.isVisible())) {
    await playTurn(sam, memory);
    // A miss turns back on its own, or with the next card.
  }
  await expect(sam.getByText('Board cleared', { exact: true })).toBeVisible();
  await expect(
    sam.getByRole('button', { name: 'Challenge a friend' }).first(),
  ).toBeVisible();
  expect(sockets).toBe(0);
});
