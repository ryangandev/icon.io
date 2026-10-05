import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { createRoom, expect, joinRoom, test } from './fixtures';

/** A server of this test's own, beside the one every other test shares. */
const PORT = Number(process.env.E2E_PORT ?? 3310) + 1;
const SERVER = `http://localhost:${PORT}`;

/** Starts the production build as the host does, and waits until it listens. */
async function startServer(): Promise<ChildProcess> {
  const child = spawn(process.execPath, ['server/build/server/server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise<void>((resolve, reject) => {
    child.once('exit', (code) => reject(new Error(`server exited: ${code}`)));
    child.stdout?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('Listening on port')) resolve();
    });
  });
  return child;
}

test('a room says so when the server restarts under it', async ({ player }) => {
  let server = await startServer();
  try {
    const maya = await player('Maya', { server: SERVER });
    const leo = await player('Leo', { server: SERVER });
    await joinRoom(leo, await createRoom(maya, 'minesweeper'));
    await maya.getByRole('button', { name: 'Start game' }).click();
    await expect(leo.getByText('Pick a cell')).toBeVisible();

    // What the host does on every deploy.
    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    expect(await exited).toEqual([0, null]);
    for (const page of [maya, leo]) {
      await expect(page.getByText('Zumpo just restarted.')).toBeVisible();
    }

    // The page stays put once the server is back, and the lobby works.
    server = await startServer();
    await expect(leo.getByText('Zumpo just restarted.')).toBeVisible();
    await maya.getByRole('link', { name: 'Back to rooms' }).click();
    await expect(maya).toHaveURL(/\/games\/minesweeper$/);
    await expect(maya.getByText('Finding your people…')).toBeHidden({
      timeout: 20_000,
    });
  } finally {
    server.kill('SIGKILL');
  }
});
