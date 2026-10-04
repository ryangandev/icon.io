import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DrawAndGuessRoomState } from '../models/types.js';
import {
  collectChat,
  collectStates,
  createRoom,
  joinRoom,
  playToDrawingPhase,
  settle,
  SLOW_DRAWING,
  startGame,
  startTestServer,
  syncRoom,
  waitFor,
  waitForChat,
  waitForDrawState,
  type TestServer,
} from './helpers/test-server.js';

/** Matches the harness default; short enough to watch a seat expire. */
const GRACE_MS = 600;

describe('player identity', () => {
  let harness: TestServer;

  beforeEach(async () => {
    harness = await startTestServer();
  });

  afterEach(async () => {
    await harness.teardown();
  });

  it('issues an identity to a client that has none', async () => {
    const client = await harness.connect();

    expect(client.playerId).toMatch(/^[0-9a-f-]{36}$/);
    expect(client.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('says how long a dropped connection keeps its seats', async () => {
    const client = await harness.connect();

    expect(client.reconnectGraceMs).toBe(GRACE_MS);
  });

  it('gives two clients different identities', async () => {
    const [first, second] = await Promise.all([
      harness.connect(),
      harness.connect(),
    ]);

    expect(first.playerId).not.toBe(second.playerId);
    expect(first.token).not.toBe(second.token);
  });

  it('returns the same identity to a client that proves it', async () => {
    const original = await harness.connect();
    const returned = await harness.reload(original);

    expect(returned.playerId).toBe(original.playerId);
    expect(returned.token).toBe(original.token);
    expect(returned.id).not.toBe(original.id);
  });

  /*
   * Every player id in a room is broadcast to everyone in it, so an id alone
   * would let any player take any other player's seat just by sending theirs.
   * The token is what makes the claim mean something.
   */
  it('refuses to hand over an identity without the right token', async () => {
    const victim = await harness.connect();

    const thief = await harness.connect({
      playerId: victim.playerId,
      token: 'f'.repeat(64),
    });

    expect(thief.playerId).not.toBe(victim.playerId);
  });

  it('ignores a claim to an identity that does not exist', async () => {
    const invented = await harness.connect({
      playerId: randomUUID(),
      token: 'a'.repeat(64),
    });

    expect(invented.playerId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('ignores a malformed claim rather than dropping the connection', async () => {
    const client = await harness.connect({
      playerId: 'not-a-uuid',
      token: 'short',
    });

    expect(client.connected).toBe(true);
    expect(client.playerId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('forgets an identity once nobody could still be using it', async () => {
    const client = await harness.connect();
    expect(harness.server.sessions.size()).toBe(1);

    client.close();
    await settle(200);

    // Still known: a dropped connection may be a reload in progress.
    expect(harness.server.sessions.size()).toBe(1);

    await settle(GRACE_MS + 400);
    expect(harness.server.sessions.size()).toBe(0);
  });
});

describe('reconnecting to a room', () => {
  let harness: TestServer;

  beforeEach(async () => {
    harness = await startTestServer();
  });

  afterEach(async () => {
    await harness.teardown();
  });

  /*
   * The bug this all exists for. A reload used to make you a different person,
   * so the room removed one player and admitted a stranger with no score.
   */
  it('keeps a player and their points across a reload', async () => {
    // A longer drawing phase, so the turn does not end mid-assertion.
    await harness.teardown();
    harness = await startTestServer(SLOW_DRAWING);

    const { roomId, guesser, word } = await playToDrawingPhase(harness);

    const scored = waitForDrawState(guesser, (s) =>
      s.scoredThisTurn.includes(guesser.playerId),
    );
    guesser.emit('chat:send', roomId, word);
    await scored;

    const before = harness.server.rooms[roomId]!.playerList[guesser.playerId];
    const scoreBefore = before!.points;
    expect(scoreBefore).toBeGreaterThan(0);

    const returned = await harness.reload(guesser);
    const { state } = await syncRoom(returned, roomId);

    expect(returned.playerId).toBe(guesser.playerId);
    expect(state.playerList[returned.playerId]).toMatchObject({
      points: scoreBefore,
      isConnected: true,
    });
    expect(state.currentPlayerCount).toBe(2);
  });

  it('holds the seat while the player is away rather than removing them', async () => {
    const alice = await harness.connect();
    const bob = await harness.connect();
    const roomId = await createRoom(alice, { username: 'Alice' });
    await joinRoom(bob, roomId, 'Bob');

    const seen = waitForDrawState(
      alice,
      (state) => state.playerList[bob.playerId]?.isConnected === false,
    );
    bob.close();

    // The room still counts them, and says they are away.
    const state = await seen;
    expect(state.currentPlayerCount).toBe(2);
    expect(state.playerList[bob.playerId]?.isConnected).toBe(false);
  });

  it('gives the seat up once the grace period runs out', async () => {
    const alice = await harness.connect();
    const bob = await harness.connect();
    const roomId = await createRoom(alice, { username: 'Alice' });
    await joinRoom(bob, roomId, 'Bob');

    const gone = waitForDrawState(
      alice,
      (state) => !state.playerList[bob.playerId],
      GRACE_MS + 1500,
    );
    bob.close();

    expect((await gone).currentPlayerCount).toBe(1);
    expect(harness.server.rooms[roomId]?.playerList[bob.playerId]).toBe(
      undefined,
    );
  });

  it('keeps ownership with a player who is only away', async () => {
    const owner = await harness.connect();
    const guest = await harness.connect();
    const roomId = await createRoom(owner, { username: 'Ada' });
    await joinRoom(guest, roomId, 'Grace');

    const returned = await harness.reload(owner);
    const { state } = await syncRoom(returned, roomId);

    expect(state.owner).toEqual({
      playerId: returned.playerId,
      username: 'Ada',
    });
  });

  it('hands ownership on only once the grace period expires', async () => {
    const owner = await harness.connect();
    const guest = await harness.connect();
    const roomId = await createRoom(owner, { username: 'Ada' });
    await joinRoom(guest, roomId, 'Grace');

    owner.close();
    await settle(200);
    expect(harness.server.rooms[roomId]?.owner.username).toBe('Ada');

    await settle(GRACE_MS + 400);
    expect(harness.server.rooms[roomId]?.owner.username).toBe('Grace');
  });

  /*
   * Leaving is deliberate; disconnecting might not be. Clicking Leave must not
   * hold a seat that the player has said they do not want.
   */
  it('does not hold a seat for a player who leaves deliberately', async () => {
    const alice = await harness.connect();
    const bob = await harness.connect();
    const roomId = await createRoom(alice, { username: 'Alice' });
    await joinRoom(bob, roomId, 'Bob');

    bob.emit('room:leave', roomId);
    await settle(200);

    const room = harness.server.rooms[roomId];
    expect(room?.playerList[bob.playerId]).toBeUndefined();
    expect(room?.currentPlayerCount).toBe(1);
  });

  it('tells the room when a player drops and when they come back', async () => {
    const alice = await harness.connect();
    const bob = await harness.connect();
    const roomId = await createRoom(alice, { username: 'Alice' });
    await joinRoom(bob, roomId, 'Bob');
    await settle();

    const messages = collectChat(alice);
    const states = collectStates(alice);
    await harness.reload(bob);
    await settle(200);

    expect(messages.map(({ kind, text }) => ({ kind, text }))).toEqual([
      { kind: 'alert', text: 'Bob lost connection.' },
      { kind: 'system', text: 'Bob reconnected.' },
    ]);
    expect(states.at(-1)?.playerList[bob.playerId]?.isConnected).toBe(true);
  });

  /*
   * The drawing is on the server, so a drawer's turn waits for them briefly,
   * and they pick up where they left off: word, drawing and all.
   */
  it('gives a reloaded drawer their turn, their word and their drawing back', async () => {
    await harness.teardown();
    harness = await startTestServer(SLOW_DRAWING);

    const { roomId, drawer, guesser, word } = await playToDrawingPhase(harness);
    drawer.emit('dg:draw:start', roomId, { x: 4, y: 4 }, '#123456', 8);
    drawer.emit('dg:draw:move', roomId, { x: 40, y: 40 }, '#123456', 8);
    await settle(50);

    const holding = waitForDrawState(guesser, (s) => s.drawerHoldEndsInMs > 0);
    const returned = await harness.reload(drawer);
    // The room said it was waiting for them, and for how long.
    expect((await holding).drawerHoldEndsInMs).toBeLessThanOrEqual(10_000);

    const canvasAgain = waitFor(returned, 'dg:canvas:sync');
    const state = (await syncRoom(returned, roomId))
      .state as DrawAndGuessRoomState;

    expect(state.word).toBe(word);
    expect(state.phase).toBe('drawing');
    expect(state.currentDrawer).toBe(drawer.playerId);
    expect(state.drawerHoldEndsInMs).toBe(0);
    expect(await canvasAgain).toEqual([
      roomId,
      [
        {
          color: '#123456',
          size: 8,
          points: [
            { x: 4, y: 4 },
            { x: 40, y: 40 },
          ],
        },
      ],
    ]);
  });

  it('tells the room when the drawer is back', async () => {
    await harness.teardown();
    harness = await startTestServer(SLOW_DRAWING);

    const { drawer, guesser } = await playToDrawingPhase(harness);
    const back = waitForChat(guesser, (m) => m.text.includes('drawer is back'));
    const resumed = waitForDrawState(
      guesser,
      (s) =>
        s.playerList[drawer.playerId]?.isConnected === true &&
        s.drawerHoldEndsInMs === 0,
    );
    await settle(50);
    await harness.reload(drawer);

    expect((await back).kind).toBe('system');
    expect((await resumed).phase).toBe('drawing');
  });

  /*
   * The hold is short. A room whose drawer has actually gone should not be left
   * staring at a frozen canvas for the whole reconnect grace.
   */
  it('gives up on a drawer who does not come back inside the hold', async () => {
    await harness.teardown();
    harness = await startTestServer({ ...SLOW_DRAWING, drawerHold: 0.3 });

    const { roomId, drawer, guesser } = await playToDrawingPhase(harness);

    const nextTurn = waitForDrawState(guesser, (s) => s.turn === 2, 3000);
    const gaveUp = waitForChat(guesser, (m) =>
      m.text.includes('did not come back'),
    );
    drawer.close();

    const next = await nextTurn;
    expect(next.currentDrawer).toBe(guesser.playerId);
    expect(next.drawerHoldEndsInMs).toBe(0);
    expect((await gaveUp).kind).toBe('alert');
    // The seat is still theirs; only the turn is gone.
    expect(
      harness.server.rooms[roomId]?.playerList[drawer.playerId],
    ).toBeDefined();
  });

  /*
   * Nothing has been invested in a turn whose word has not been chosen yet, and
   * an absent drawer will not be choosing one, so that case is skipped on the
   * spot rather than held.
   */
  it('skips the turn of a drawer who drops before choosing a word', async () => {
    await harness.teardown();
    harness = await startTestServer(SLOW_DRAWING);

    const alice = await harness.connect();
    const bob = await harness.connect();
    const carol = await harness.connect();
    const roomId = await createRoom(alice, { username: 'Alice', rounds: 1 });
    await joinRoom(bob, roomId, 'Bob');
    await joinRoom(carol, roomId, 'Carol');

    const byId = new Map([
      [alice.playerId, alice],
      [bob.playerId, bob],
      [carol.playerId, carol],
    ]);

    const firstTurn = waitForDrawState(alice, (s) => s.phase === 'choosing');
    await startGame(alice, roomId);
    const { currentDrawer } = await firstTurn;

    const drawer = byId.get(currentDrawer)!;
    const witness = drawer === alice ? bob : alice;

    const turnMovedOn = waitForDrawState(witness, (s) => s.turn === 2);
    drawer.close();
    await turnMovedOn;

    // Turn moved on, but the seat is still theirs while they might return.
    const room = harness.server.rooms[roomId];
    expect(room?.playerList[currentDrawer]).toBeDefined();
    expect(room?.playerList[currentDrawer]?.isConnected).toBe(false);
    expect(room?.isGameStarted).toBe(true);
  });

  it('does not deal a turn to a player who is away', async () => {
    const alice = await harness.connect();
    const bob = await harness.connect();
    const carol = await harness.connect();
    const roomId = await createRoom(alice, { username: 'Alice', rounds: 1 });
    await joinRoom(bob, roomId, 'Bob');
    await joinRoom(carol, roomId, 'Carol');

    const states = collectStates(alice);

    // Carol drops before the game starts and never comes back.
    carol.close();
    await settle(100);

    const ended = waitForDrawState(alice, (s) => s.lastGame !== null, 9000);
    await startGame(alice, roomId);
    await ended;

    expect(
      states.filter((s) => s.phase === 'choosing').map((s) => s.currentDrawer),
    ).not.toContain(carol.playerId);
  });

  it('lets a returning player chat and guess again', async () => {
    const alice = await harness.connect();
    const bob = await harness.connect();
    const roomId = await createRoom(alice, { username: 'Alice' });
    await joinRoom(bob, roomId, 'Bob');

    const returned = await harness.reload(bob);
    await settle(200);

    const heard = waitForChat(alice, (m) => m.kind === 'player');
    returned.emit('chat:send', roomId, 'back again');

    expect(await heard).toMatchObject({
      playerId: bob.playerId,
      username: 'Bob',
      text: 'back again',
    });
  });

  it('does not let a returning player take somebody else s seat', async () => {
    const alice = await harness.connect();
    const bob = await harness.connect();
    const roomId = await createRoom(alice, { username: 'Alice' });
    await joinRoom(bob, roomId, 'Bob');
    await settle();

    // A third client claims Alice's id with a token it invented.
    const heard = collectChat(bob);
    const impostor = await harness.connect({
      playerId: alice.playerId,
      token: '0'.repeat(64),
    });
    impostor.emit('chat:send', roomId, 'I am Alice');
    await settle();

    expect(impostor.playerId).not.toBe(alice.playerId);
    expect(heard).toEqual([]);
    expect(harness.server.rooms[roomId]?.owner.playerId).toBe(alice.playerId);
    expect(
      harness.server.rooms[roomId]?.playerList[alice.playerId]?.isConnected,
    ).toBe(true);
  });
});
