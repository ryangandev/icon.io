import { once } from 'node:events';
import { createRoom, expect, joinRoom, test } from './fixtures';
import { startServer } from './own-server';

test('a room says so when the server restarts under it', async ({ player }) => {
  let server = await startServer();
  try {
    const maya = await player('Maya', { server: server.url });
    const leo = await player('Leo', { server: server.url });
    await joinRoom(leo, await createRoom(maya, 'minesweeper'));
    await maya.getByRole('button', { name: 'Start game' }).click();
    await expect(leo.getByText('Pick a cell')).toBeVisible();

    // What the host does on every deploy.
    const exited = once(server.process, 'exit');
    server.process.kill('SIGTERM');
    expect(await exited).toEqual([0, null]);
    for (const page of [maya, leo]) {
      await expect(page.getByText('Zumpo just restarted.')).toBeVisible();
    }

    // The page stays put once the server is back, and the lobby works.
    server = await startServer(server.port);
    await expect(leo.getByText('Zumpo just restarted.')).toBeVisible();
    await maya.getByRole('link', { name: 'Back to rooms' }).click();
    await expect(maya).toHaveURL(/\/games\/minesweeper$/);
    await expect(maya.getByText('Finding your people…')).toBeHidden({
      timeout: 20_000,
    });
  } finally {
    server.process.kill('SIGKILL');
  }
});
