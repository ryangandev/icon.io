import { afterEach, describe, expect, it } from 'vitest';
import {
  FAST_MAKE24,
  FAST_MINESWEEPER,
  FAST_PAIRS,
  FAST_PHASES,
  createRoom,
  joinRoom,
  settle,
  startTestServer,
  type TestServer,
} from './helpers/test-server.js';

describe('what one player and one server may hold', () => {
  let harness: TestServer;

  afterEach(async () => {
    await harness.teardown();
  });

  it('gives up a seat elsewhere when a player joins another room', async () => {
    harness = await startTestServer();
    const alice = await harness.connect();
    const bob = await harness.connect();
    const carol = await harness.connect();
    const first = await createRoom(alice, { username: 'Alice' });
    await joinRoom(carol, first, 'Carol');
    const second = await createRoom(bob, { username: 'Bob' });

    await joinRoom(alice, second, 'Alice');
    await settle();

    const rooms = harness.server.rooms;
    expect(Object.keys(rooms[first]!.playerList)).toEqual([carol.playerId]);
    expect(rooms[first]!.owner.playerId).toBe(carol.playerId);
    expect(Object.keys(rooms[second]!.playerList)).toEqual([
      bob.playerId,
      alice.playerId,
    ]);
  });

  it('gives up a seat elsewhere when a player makes a room', async () => {
    harness = await startTestServer();
    const alice = await harness.connect();
    const first = await createRoom(alice, { username: 'Alice' });

    const second = await createRoom(alice, { username: 'Alice' });
    await settle();

    expect(harness.server.rooms[first]).toBeUndefined();
    expect(
      harness.server.rooms[second]?.playerList[alice.playerId],
    ).toBeDefined();
  });

  it('makes no more rooms than it can hold', async () => {
    harness = await startTestServer(
      FAST_PHASES,
      0.6,
      FAST_MINESWEEPER,
      FAST_MAKE24,
      FAST_PAIRS,
      { maxRooms: 2 },
    );
    const [alice, bob, carol] = await Promise.all([
      harness.connect(),
      harness.connect(),
      harness.connect(),
    ]);
    await createRoom(alice);
    await createRoom(bob);

    const refused = await carol.timeout(3000).emitWithAck('room:create', {
      gameType: 'draw-and-guess',
      roomName: 'One too many',
      username: 'Carol',
      maxPlayers: 4,
      password: '',
      settings: { rounds: 1 },
    });

    expect(refused).toMatchObject({
      ok: false,
      error: { type: 'tooManyRooms' },
    });
    expect(Object.keys(harness.server.rooms)).toHaveLength(2);
  });

  it('drops a connection that sends an oversized packet', async () => {
    harness = await startTestServer();
    const alice = await harness.connect();
    const roomId = await createRoom(alice);

    const closed = new Promise<string>((resolve) =>
      alice.once('disconnect', resolve),
    );
    alice.emit('chat:send', roomId, 'x'.repeat(32 * 1024));

    expect(await closed).toBe('transport close');
  });
});
