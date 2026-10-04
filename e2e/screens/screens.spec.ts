import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import {
  createRoom,
  dropConnection,
  expect,
  holdConnection,
  joinRoom,
  test,
  type PlayerOptions,
} from '../fixtures';
import { COMPARE_DIR, figmaSize, writeReport } from './report';

/*
 * Each test plays one stretch of the product and captures the Figma screens
 * it passes through, named by their codes. Captures are full pages at Figma's
 * scale, so a screen and its preview can be laid side by side. The tests run
 * one at a time, and each one's rooms close with its players, so a room list
 * shows only the rooms its own test made.
 */

mkdirSync(COMPARE_DIR, { recursive: true });

const desktop: PlayerOptions = { scale: 1, droppable: true };
const phone: PlayerOptions = { scale: 1, droppable: true, phone: true };

/**
 * Captures the page in a window as tall as the Figma frame, so a page shorter
 * than the frame fills it as it would on that screen, and a longer one runs on.
 */
async function shot(page: Page, code: string) {
  const viewport = page.viewportSize()!;
  const [, height] = figmaSize(code);
  await page.setViewportSize({ width: viewport.width, height });
  await page.evaluate(() => document.fonts.ready);
  // Away from every control, so no hover state is captured.
  await page.mouse.move(0, 0);
  await page.screenshot({
    path: path.join(COMPARE_DIR, `${code}.png`),
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  });
  await page.setViewportSize(viewport);
}

async function startGame(host: Page) {
  await host.getByRole('button', { name: 'Start game' }).click();
}

test.afterAll(writeReport);

test('platform pages', async ({ player }) => {
  const visitor = await player('Sam', { ...desktop, named: false });
  await visitor.goto('/');
  await shot(visitor, 'P01');
  await visitor.goto('/name');
  await shot(visitor, 'P02');
  await visitor.getByRole('button', { name: 'Let’s play' }).click();
  await shot(visitor, 'P03');

  const sam = await player('Sam', desktop);
  await sam.goto('/games');
  await shot(sam, 'P04');
  await sam.getByRole('button', { name: 'Sam: your name' }).click();
  await expect(sam.getByRole('dialog', { name: 'Sam' })).toBeVisible();
  await shot(sam, 'P13');
  await sam.keyboard.press('Escape');
  await sam.goto('/games/draw-and-guess/rooms/gone');
  await expect(
    sam.getByRole('heading', { name: 'This room has packed up.' }),
  ).toBeVisible();
  await shot(sam, 'P09');
  await sam.goto('/no-such-page');
  await shot(sam, 'P10');
  await sam.goto('/how-to-play');
  await shot(sam, 'P14');

  const newcomer = await player('Sam', { ...phone, named: false });
  await newcomer.goto('/');
  await shot(newcomer, 'MO01');
  await newcomer.goto('/name');
  await shot(newcomer, 'MO02');
  const samOnPhone = await player('Sam', phone);
  await samOnPhone.goto('/games');
  await shot(samOnPhone, 'MO03');
});

test('before a connection, and when it fails', async ({ player }) => {
  const maya = await player('Maya', desktop);
  holdConnection(maya);
  await maya.goto('/games/draw-and-guess');
  await expect(maya.getByText('Finding your people…')).toBeVisible();
  await shot(maya, 'DL03');
  await maya.goto('/games/minesweeper');
  await expect(maya.getByText('Finding your people…')).toBeVisible();
  await shot(maya, 'ML03');
  await maya.goto('/games/draw-and-guess/rooms/somewhere');
  await expect(maya.getByText('Getting the room ready…')).toBeVisible();
  await shot(maya, 'P05');
  // Five retries with a growing delay before the client gives up.
  await expect(maya.getByRole('button', { name: 'Try again' })).toBeVisible({
    timeout: 60_000,
  });
  await shot(maya, 'P06');
});

/** The lobby pages of one game, empty and then with a room in each state. */
async function lobbyScreens(
  player: (name: string, options?: PlayerOptions) => Promise<Page>,
  game: 'draw-and-guess' | 'minesweeper',
  codes: {
    list: string;
    empty: string;
    create: string;
    invalid: string;
    pending: string;
    menu: string;
    password: string;
    rejected: string;
    unavailable: string;
  },
) {
  const sam = await player('Sam', desktop);
  await sam.goto(`/games/${game}`);
  await expect(sam.getByText('Finding your people…')).toBeHidden();
  await shot(sam, codes.empty);

  const maya = await player('Maya', desktop);
  await maya.goto(`/games/${game}/new`);
  await shot(maya, codes.create);
  await maya.getByLabel('Room name').fill('');
  await maya.getByRole('button', { name: 'Create room' }).click();
  await shot(maya, codes.invalid);
  await maya.getByLabel('Room name').fill('Maya’s room');
  await maya.getByLabel(game === 'minesweeper' ? 'Board' : 'Seats').click();
  await expect(maya.getByRole('listbox')).toBeVisible();
  await shot(maya, codes.menu);
  await maya.keyboard.press('Escape');
  const restore = await dropConnection(maya);
  await maya.getByRole('button', { name: 'Create room' }).click();
  await expect(maya.getByText('Creating your room…')).toBeVisible();
  await shot(maya, codes.pending);
  restore();
  await expect(maya.getByRole('button', { name: 'Leave room' })).toBeVisible({
    timeout: 20_000,
  });

  // A room in each state the list shows: open, private, full and playing.
  const ryan = await player('Ryan', desktop);
  const privateRoom = await createRoom(ryan, game, {
    name: 'Ryan’s room',
    password: 'otter',
  });
  const leo = await player('Leo', desktop);
  const ada = await player('Ada', desktop);
  await joinRoom(
    ada,
    await createRoom(leo, game, { name: 'Leo’s room', seats: 2 }),
  );
  const kai = await player('Kai', desktop);
  const noor = await player('Noor', desktop);
  const playing = await createRoom(kai, game, { name: 'Kai’s room' });
  await joinRoom(noor, playing);
  await startGame(kai);

  await expect(sam.getByRole('article')).toHaveCount(4);
  await shot(sam, codes.list);
  if (game === 'draw-and-guess') {
    const samOnPhone = await player('Sam', phone);
    await samOnPhone.goto(`/games/${game}`);
    await expect(samOnPhone.getByRole('article')).toHaveCount(4);
    await shot(samOnPhone, 'MO04');
    await samOnPhone.goto(`/games/${game}/new`);
    await shot(samOnPhone, 'MO05');
    await samOnPhone.goto(privateRoom);
    await shot(samOnPhone, 'MO06');
  }

  await sam.goto(privateRoom);
  await shot(sam, codes.password);
  await sam.getByLabel('Room password').fill('seal');
  await sam.getByRole('button', { name: 'Join room' }).click();
  await expect(sam.getByText('That password didn’t work.')).toBeVisible();
  await shot(sam, codes.rejected);
  await sam.goto(playing);
  await expect(
    sam.getByRole('heading', { name: 'That room moved on.' }),
  ).toBeVisible();
  await shot(sam, codes.unavailable);
}

test('Draw & Guess rooms and their lists', async ({ player }) => {
  await lobbyScreens(player, 'draw-and-guess', {
    list: 'DL01',
    empty: 'DL02',
    create: 'DL04',
    invalid: 'DL05',
    pending: 'DL06',
    menu: 'DL10',
    password: 'DL07',
    rejected: 'DL08',
    unavailable: 'DL09',
  });
});

test('Draw & Guess rounds menu', async ({ player }) => {
  const maya = await player('Maya', desktop);
  await maya.goto('/games/draw-and-guess/new');
  await maya.getByLabel('Rounds').click();
  await expect(maya.getByRole('listbox')).toBeVisible();
  await shot(maya, 'DL11');
});

test('Minesweeper rooms and their lists', async ({ player }) => {
  await lobbyScreens(player, 'minesweeper', {
    list: 'ML01',
    empty: 'ML02',
    create: 'ML04',
    invalid: 'ML05',
    pending: 'ML06',
    menu: 'ML10',
    password: 'ML07',
    rejected: 'ML08',
    unavailable: 'ML09',
  });
});

interface Seat {
  name: string;
  page: Page;
  phone?: boolean;
}

/** The four players of Figma's example story; Leo is on a phone. */
async function fourPlayers(
  player: (name: string, options?: PlayerOptions) => Promise<Page>,
): Promise<Seat[]> {
  return [
    { name: 'Maya', page: await player('Maya', desktop) },
    { name: 'Ryan', page: await player('Ryan', desktop) },
    { name: 'Sam', page: await player('Sam', desktop) },
    { name: 'Leo', page: await player('Leo', phone), phone: true },
  ];
}

const WORD_CHOICE = /\d+ letters?$/;

/** Whoever is offered words, once the next turn has begun. */
async function nextDrawer(seats: Seat[]): Promise<Seat> {
  const offered = (seat: Seat) =>
    seat.page.getByRole('button', { name: WORD_CHOICE }).first();
  await expect
    .poll(
      async () => {
        for (const seat of seats) if (await offered(seat).isVisible()) return 1;
        return 0;
      },
      { timeout: 30_000 },
    )
    .toBe(1);
  for (const seat of seats) if (await offered(seat).isVisible()) return seat;
  throw new Error('no drawer');
}

async function chooseAndDraw(drawer: Page): Promise<string> {
  const choice = drawer.getByRole('button', { name: WORD_CHOICE }).first();
  const word = (await choice.locator('span').first().textContent())!.trim();
  await choice.click();
  await draw(drawer);
  return word;
}

async function draw(drawer: Page) {
  const canvas = drawer.getByLabel('Drawing canvas');
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  const at = (x: number, y: number) =>
    [box.x + box.width * x, box.y + box.height * y] as const;
  await drawer.mouse.move(...at(0.3, 0.6));
  await drawer.mouse.down();
  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    await drawer.mouse.move(
      ...at(0.3 + 0.4 * t, 0.6 - 0.25 * Math.sin(Math.PI * t)),
    );
  }
  await drawer.mouse.up();
}

/** The word the drawer's turn bar shows. */
async function wordOf(drawer: Page): Promise<string> {
  return (await drawer
    .getByRole('region', { name: 'Turn' })
    .locator('p > span')
    .first()
    .textContent())!.trim();
}

async function guess(seat: Seat, text: string) {
  const box = seat.page.getByRole('textbox', {
    name: seat.phone ? 'Guess' : 'Message',
  });
  await box.fill(text);
  await box.press('Enter');
}

test('a Draw & Guess game', async ({ player }) => {
  test.setTimeout(600_000);
  const seats = await fourPlayers(player);
  const [maya, ryan, sam, leo] = seats;

  const link = await createRoom(maya.page, 'draw-and-guess', { rounds: 1 });
  await shot(maya.page, 'D01');
  for (const seat of [ryan, sam, leo]) await joinRoom(seat.page, link);
  await shot(maya.page, 'D02');
  await shot(ryan.page, 'D03');
  await maya.page
    .getByRole('button', { name: 'Invite friends' })
    .first()
    .click();
  await shot(maya.page, 'P12');
  await maya.page.getByRole('button', { name: 'Done' }).click();
  await startGame(maya.page);

  // One round: everybody draws once, Leo on his phone.
  const desktopTurns = ['plain', 'dropped', 'timed out'] as const;
  for (let turn = 0; turn < 4; turn++) {
    const drawer = await nextDrawer(seats);
    const guessers = seats.filter((seat) => seat !== drawer);
    const watcher = guessers.find((seat) => !seat.phone)!;

    if (drawer.phone) {
      await shot(drawer.page, 'MO07');
      const word = await chooseAndDraw(drawer.page);
      await shot(drawer.page, 'MO08');
      for (const seat of guessers) await guess(seat, word);
      continue;
    }

    const kind = desktopTurns[seats.filter((s) => !s.phone).indexOf(drawer)];
    if (kind === 'plain') {
      await shot(drawer.page, 'D04');
      await shot(watcher.page, 'D05');
      const word = await chooseAndDraw(drawer.page);
      await shot(drawer.page, 'D06');
      await shot(watcher.page, 'D07');
      await shot(leo.page, 'MO09');
      await leo.page.getByRole('tab', { name: /Players/ }).click();
      await shot(leo.page, 'MO15');
      await leo.page.getByRole('tab', { name: 'Chat' }).click();
      await shot(leo.page, 'MO16');
      await leo.page.getByRole('tab', { name: 'Board' }).click();

      await watcher.page.getByRole('button', { name: 'Leave room' }).click();
      await shot(watcher.page, 'P11');
      await watcher.page.getByRole('button', { name: 'Stay' }).click();

      await guess(watcher, word);
      await expect(watcher.page.getByText(/^You got it! \+\d+$/)).toBeVisible();
      await shot(watcher.page, 'D08');
      for (const seat of guessers)
        if (seat !== watcher) await guess(seat, word);
      await expect(
        maya.page.getByText('The word was', { exact: true }),
      ).toBeVisible();
      await shot(drawer.page, 'D09');
      await shot(leo.page, 'MO10');
    } else if (kind === 'dropped') {
      await chooseAndDraw(drawer.page);
      const restore = await dropConnection(drawer.page);
      const notice = watcher.page.getByText(/Their turn is skipped/);
      await expect(notice).toBeVisible();
      await shot(watcher.page, 'D10');
      await expect(
        drawer.page.getByRole('heading', { name: 'A little pause.' }),
      ).toBeVisible();
      await shot(drawer.page, 'P07');
      // The hold runs out and the turn moves on without them.
      await expect(notice).toBeHidden({
        timeout: 20_000,
      });
      await shot(watcher.page, 'D11');
      restore();
      await expect(
        drawer.page.getByRole('heading', { name: 'Draw & Guess' }),
      ).toBeVisible({ timeout: 20_000 });
    } else {
      await expect(
        drawer.page.getByText('Time ran out, so this one was picked for you'),
      ).toBeVisible({ timeout: 30_000 });
      await draw(drawer.page);
      await shot(drawer.page, 'D12');
      const word = await wordOf(drawer.page);
      for (const seat of guessers) await guess(seat, word);
    }
  }

  await expect(maya.page.getByText('Game over', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await shot(maya.page, 'D13');
  await shot(ryan.page, 'D14');
});

/** A game left by all but its host: D15 and M16. */
async function endedEarly(
  player: (name: string, options?: PlayerOptions) => Promise<Page>,
  game: 'draw-and-guess' | 'minesweeper',
  code: string,
) {
  const maya = await player('Maya', desktop);
  const ryan = await player('Ryan', desktop);
  await joinRoom(ryan, await createRoom(maya, game));
  await startGame(maya);
  await ryan.getByRole('button', { name: 'Leave room' }).click();
  await ryan
    .getByRole('dialog')
    .getByRole('button', { name: 'Leave room' })
    .click();
  await expect(maya.getByText('Game ended', { exact: true })).toBeVisible();
  await shot(maya, code);
}

test('a Draw & Guess game left early', async ({ player }) => {
  await endedEarly(player, 'draw-and-guess', 'D15');
});

test('a seat released while away', async ({ player }) => {
  test.setTimeout(120_000);
  const maya = await player('Maya', desktop);
  const ryan = await player('Ryan', desktop);
  await joinRoom(ryan, await createRoom(maya, 'draw-and-guess'));
  const restore = await dropConnection(ryan);
  // The server keeps the seat for 30 seconds.
  await expect(
    maya.getByRole('region', { name: 'Players' }).getByText('Ryan'),
  ).toBeHidden({ timeout: 45_000 });
  restore();
  await expect(
    ryan.getByRole('heading', { name: 'Let’s find you a fresh start.' }),
  ).toBeVisible({ timeout: 20_000 });
  await shot(ryan, 'P08');
});

const HIDDEN = /: hidden$/;

function cell(page: Page, row: number, column: number) {
  return page.getByRole('button', {
    name: new RegExp(`^Row ${row}, column ${column}: hidden$`),
  });
}

/** Whose result this round was a mine, if anybody's. */
async function mineHitBy(seats: Seat[]): Promise<Seat | undefined> {
  for (const seat of seats) {
    if (await seat.page.getByText(/^Mine\. /).isVisible()) return seat;
  }
  return undefined;
}

test('a Minesweeper game', async ({ player }) => {
  test.setTimeout(600_000);
  const seats = await fourPlayers(player);
  const [maya, ryan, sam, leo] = seats;

  const link = await createRoom(maya.page, 'minesweeper');
  await shot(maya.page, 'M01');
  for (const seat of [ryan, sam, leo]) await joinRoom(seat.page, link);
  await shot(maya.page, 'M02');
  await shot(ryan.page, 'M03');
  await startGame(maya.page);

  await expect(maya.page.getByText('Pick a cell')).toBeVisible();
  await shot(maya.page, 'M04');
  await shot(leo.page, 'MO11');
  await cell(maya.page, 2, 2).click();
  await shot(maya.page, 'M05');
  await cell(leo.page, 8, 2).click();
  await shot(leo.page, 'MO12');
  // Ryan and Sam share a cell; their reward splits if it is safe.
  await cell(ryan.page, 5, 5).click();
  await cell(sam.page, 5, 5).click();
  await expect(maya.page.getByText(/Round 1 results/).first()).toBeVisible();
  await shot(maya.page, 'M07');
  await shot(ryan.page, 'M09');
  await shot(leo.page, 'MO13');
  let mine = await mineHitBy(seats);
  if (mine) await shot(mine.page, 'M08');

  // Round 2: Sam does not pick, so the clock picks the safest cell for him.
  await expect(maya.page.getByText('Pick a cell')).toBeVisible({
    timeout: 20_000,
  });
  await shot(maya.page, 'M11');
  for (const seat of [maya, ryan, leo]) {
    await seat.page.getByRole('button', { name: HIDDEN }).first().click();
  }
  await expect(
    sam.page.getByText('The safest cell was picked for you', { exact: false }),
  ).toBeVisible({ timeout: 30_000 });
  await shot(sam.page, 'M10');

  // Then everybody picks, riskiest first, until somebody finds a mine and
  // the board is done.
  const over = maya.page.getByText('Game over', { exact: true });
  for (let round = 3; !(await over.isVisible()); round++) {
    await expect(maya.page.getByText('Pick a cell').or(over)).toBeVisible({
      timeout: 20_000,
    });
    if (await over.isVisible()) break;
    for (const [index, seat] of seats.entries()) {
      const hidden = seat.page.getByRole('button', { name: HIDDEN });
      const count = await hidden.count();
      if (count) await hidden.nth((index * 7 + round) % count).click();
    }
    await expect(maya.page.getByText('Pick a cell')).toBeHidden();
    if (!mine) {
      await expect(
        maya.page.getByText(/Round \d+ results/).first(),
      ).toBeVisible();
      mine = await mineHitBy(seats);
      if (mine) await shot(mine.page, 'M08');
    }
  }

  await shot(maya.page, 'M14');
  await shot(ryan.page, 'M15');
});

test('a Minesweeper game left early', async ({ player }) => {
  await endedEarly(player, 'minesweeper', 'M16');
});

test('the bigger Minesweeper boards', async ({ player }) => {
  for (const [board, code] of [
    ['Medium', 'M12'],
    ['Large', 'M13'],
  ] as const) {
    const maya = await player('Maya', desktop);
    const ryan = await player('Ryan', desktop);
    const leo = await player('Leo', phone);
    const link = await createRoom(maya, 'minesweeper', { board });
    await joinRoom(ryan, link);
    await joinRoom(leo, link);
    await startGame(maya);
    await expect(maya.getByText('Pick a cell')).toBeVisible();
    await shot(maya, code);
    if (board === 'Large') await shot(leo, 'MO14');
    await maya.getByRole('button', { name: 'Leave room' }).click();
    await maya
      .getByRole('dialog')
      .getByRole('button', { name: 'Leave room' })
      .click();
  }
});
