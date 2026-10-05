import {
  expect,
  test as base,
  type BrowserContext,
  type Page,
  type WebSocketRoute,
} from '@playwright/test';

export { expect };

export type GameType = 'draw-and-guess' | 'minesweeper' | 'make-24' | 'pairs';

export interface PlayerOptions {
  /** A 390 px touch screen, as Figma's mobile frames. */
  phone?: boolean;
  /** False for a first visit, before the player has chosen a name. */
  named?: boolean;
  /** Routes the player's connection through the test, for `dropConnection`. */
  droppable?: boolean;
  /** Device pixels per CSS pixel; Figma's previews are at 1. */
  scale?: number;
  /**
   * A server of the test's own, which it stops and starts under the player,
   * so connections failing while it is down are expected.
   */
  server?: string;
}

interface Fixtures {
  /** Opens a browser of its own for one player: their own tab and identity. */
  player: (name: string, options?: PlayerOptions) => Promise<Page>;
}

/**
 * Each player is a separate browser context, so two players are two people,
 * not two tabs. Anything a page logs as an error fails the test.
 */
export const test = base.extend<Fixtures>({
  player: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];
    const errors: string[] = [];
    await use(async (name, options = {}) => {
      const { phone = false, named = true, droppable = false } = options;
      const { scale = phone ? 2 : 1, server } = options;
      const context = await browser.newContext({
        ...(phone
          ? {
              viewport: { width: 390, height: 844 },
              deviceScaleFactor: scale,
              isMobile: true,
              hasTouch: true,
            }
          : {
              viewport: { width: 1440, height: 900 },
              deviceScaleFactor: scale,
            }),
        ...(server ? { baseURL: server } : {}),
      });
      contexts.push(context);
      if (named) {
        await context.addInitScript((given) => {
          if (!sessionStorage.getItem('zumpo:name')) {
            sessionStorage.setItem('zumpo:name', given);
          }
        }, name);
      }
      const page = await context.newPage();
      if (droppable) await wire(page);
      page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        // A cut connection's failed requests are the point of the test.
        const offline = droppable || server !== undefined;
        if (offline && /net::ERR_|WebSocket/.test(message.text())) return;
        errors.push(`${name}: ${message.text()}`);
      });
      return page;
    });
    await Promise.all(contexts.map((context) => context.close()));
    expect(errors, 'errors in the browser console').toEqual([]);
  },
});

export interface RoomSettings {
  name?: string;
  password?: string;
  seats?: 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** Draw & Guess: how many rounds. */
  rounds?: 1 | 2 | 3 | 4;
  /** Minesweeper or Pairs: the board, by its first word. */
  board?: 'Small' | 'Medium' | 'Large';
  /** Make 24: how many hands. */
  hands?: 5 | 10;
}

/** Makes a room through the create page and returns its link. */
export async function createRoom(
  page: Page,
  game: GameType,
  settings: RoomSettings = {},
): Promise<string> {
  await page.goto(`/games/${game}/new`);
  if (settings.name) await page.getByLabel('Room name').fill(settings.name);
  if (settings.seats) {
    await choose(page, 'Seats', new RegExp(`^${settings.seats} players$`));
  }
  if (settings.rounds) {
    await choose(page, 'Rounds', new RegExp(`^${settings.rounds} rounds?$`));
  }
  if (settings.board) {
    await choose(page, 'Board', new RegExp(`^${settings.board}`));
  }
  if (settings.hands) {
    await choose(page, 'Hands', new RegExp(`^${settings.hands} hands$`));
  }
  if (settings.password) {
    await page.getByLabel('Password (optional)').fill(settings.password);
  }
  await page.getByRole('button', { name: 'Create room' }).click();
  await page.waitForURL('**/rooms/**');
  await expect(page.getByRole('button', { name: 'Leave room' })).toBeVisible();
  return page.url();
}

/** Opens a room's link and waits for the seat. */
export async function joinRoom(page: Page, link: string): Promise<void> {
  await page.goto(link);
  await expect(page.getByRole('button', { name: 'Leave room' })).toBeVisible();
}

async function choose(page: Page, field: string, option: RegExp) {
  await page.getByLabel(field).click();
  await page.getByRole('option', { name: option }).click();
}

/** A droppable player's connection, routed through the test. */
interface Link {
  down: boolean;
  open: Set<{
    client: WebSocketRoute;
    server: WebSocketRoute;
    upgraded: boolean;
  }>;
}

const links = new WeakMap<Page, Link>();
const SOCKET = /\/socket\.io\//;

/**
 * Socket.IO starts on HTTP long-polling and upgrades to a WebSocket, so a
 * drop has to fail both. Browser offline emulation does neither to a
 * WebSocket that is already open. The WebSocket opens as a probe first, and
 * carries the connection only once the client sends Engine.IO's upgrade
 * packet, "5".
 */
async function wire(page: Page) {
  const link: Link = { down: false, open: new Set() };
  links.set(page, link);
  await page.route(SOCKET, (route) =>
    link.down ? route.abort('internetdisconnected') : route.fallback(),
  );
  await page.routeWebSocket(SOCKET, (client) => {
    if (link.down) return void client.close();
    const server = client.connectToServer();
    const pair = { client, server, upgraded: false };
    link.open.add(pair);
    client.onMessage((message) => {
      if (message === '5') pair.upgraded = true;
      server.send(message);
    });
    client.onClose((code, reason) => {
      link.open.delete(pair);
      void server.close({ code, reason });
    });
  });
}

/**
 * Cuts a droppable player's connection, as a network drop does, and keeps it
 * down until the returned function restores it.
 */
export async function dropConnection(page: Page): Promise<() => void> {
  const link = links.get(page);
  if (!link) throw new Error('dropConnection needs a droppable player');
  // A long-poll already in flight would outlive the cut; wait for the upgrade.
  await expect
    .poll(() => [...link.open].some((pair) => pair.upgraded), {
      message: 'the WebSocket upgrade',
    })
    .toBe(true);
  link.down = true;
  for (const { client, server } of link.open) {
    await server.close();
    await client.close();
  }
  link.open.clear();
  return () => {
    link.down = false;
  };
}

/**
 * Keeps a droppable player from connecting at all until the returned
 * function lets them, for the states before a first connection.
 */
export function holdConnection(page: Page): () => void {
  const link = links.get(page);
  if (!link) throw new Error('holdConnection needs a droppable player');
  link.down = true;
  return () => {
    link.down = false;
  };
}

/**
 * What the browser's Duplicate does: a new tab with this one's storage, so
 * the same player, which opens once it goes somewhere.
 */
export async function duplicateTab(page: Page): Promise<Page> {
  const storage = await page.evaluate(() => ({ ...sessionStorage }));
  const copy = await page.context().newPage();
  await copy.addInitScript((entries) => {
    for (const [key, value] of Object.entries(entries)) {
      sessionStorage.setItem(key, value);
    }
  }, storage);
  return copy;
}
