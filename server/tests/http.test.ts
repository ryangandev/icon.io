import { afterEach, describe, expect, it } from 'vitest';
import {
  createRoom,
  settle,
  startTestServer,
  type TestServer,
} from './helpers/test-server.js';

describe('the HTTP side', () => {
  let harness: TestServer;

  afterEach(async () => {
    await harness.teardown();
  });

  it('answers a health check with what it is holding', async () => {
    harness = await startTestServer();
    const alice = await harness.connect();
    await harness.connect();
    await createRoom(alice);
    await settle();

    const response = await fetch(`${harness.url}/healthz`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      rooms: 1,
      connections: 2,
    });
  });

  it('sends no CORS headers with what it serves', async () => {
    harness = await startTestServer();

    const response = await fetch(`${harness.url}/healthz`, {
      headers: { Origin: 'https://elsewhere.example' },
    });

    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});
