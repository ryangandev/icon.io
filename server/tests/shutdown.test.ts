import { describe, expect, it } from 'vitest';
import { createRoom, startTestServer, waitFor } from './helpers/test-server.js';

describe('shutting down', () => {
  it('tells every connection before closing it', async () => {
    const harness = await startTestServer();
    const owner = await harness.connect();
    const other = await harness.connect();
    await createRoom(owner, { roomName: 'Closing time' });

    const told = Promise.all([
      waitFor(owner, 'server:closing'),
      waitFor(other, 'server:closing'),
    ]);
    const reasons = Promise.all(
      [owner, other].map(
        (client) =>
          new Promise<string>((resolve) => client.once('disconnect', resolve)),
      ),
    );

    await harness.server.close();

    await told;
    // Closed by the server, which a client does not retry on its own: it is
    // the page that decides to reconnect.
    expect(await reasons).toEqual([
      'io server disconnect',
      'io server disconnect',
    ]);
    await harness.teardown();
  });

  it('closes at once with nobody connected', async () => {
    const harness = await startTestServer();
    const startedAt = performance.now();
    await harness.server.close();
    expect(performance.now() - startedAt).toBeLessThan(500);
  });
});
