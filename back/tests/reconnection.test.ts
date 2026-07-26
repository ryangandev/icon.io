import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  CanvasStroke,
  DrawAndGuessRoomState,
  PlayerInfo,
} from '../models/types.js';
import {
  collect,
  createRoom,
  joinRoom,
  playToDrawingPhase,
  settle,
  startTestServer,
  waitFor,
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
    } as never);

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
    harness = await startTestServer({
      wordSelecting: 0.2,
      drawing: 5,
      reviewing: 0.2,
    });

    const { roomId, guesser, guesserName, word } =
      await playToDrawingPhase(harness);

    const scored = waitFor<Record<string, PlayerInfo>>(
      guesser,
      'playersReceivedPointsFromCorrectGuess',
    );
    guesser.emit('takingAGuess', roomId, guesserName, word);
    await scored;

    const before = harness.server.rooms[roomId]!.playerList[guesser.playerId];
    const scoreBefore = before!.points;
    expect(scoreBefore).toBeGreaterThan(0);

    const returned = await harness.reload(guesser);
    await settle(200);

    const after = harness.server.rooms[roomId]!.playerList[returned.playerId];
    expect(returned.playerId).toBe(guesser.playerId);
    expect(after?.points).toBe(scoreBefore);
    expect(after?.isConnected).toBe(true);
    expect(harness.server.rooms[roomId]?.currentPlayerCount).toBe(2);
  });

  it('holds the seat while the player is away rather than removing them', async () => {
    const alice = await harness.connect();
    const bob = await harness.connect();
    const roomId = await createRoom(alice, { ownerUsername: 'Alice' });
    await joinRoom(alice, roomId, 'Alice');
    await joinRoom(bob, roomId, 'Bob');

    const seen = waitFor<DrawAndGuessRoomState>(
      alice,
      'clientLeaveDrawAndGuessRoomSuccess',
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
    const roomId = await createRoom(alice, { ownerUsername: 'Alice' });
    await joinRoom(alice, roomId, 'Alice');
    await joinRoom(bob, roomId, 'Bob');

    bob.close();
    await settle(GRACE_MS + 400);

    const room = harness.server.rooms[roomId];
    expect(room?.playerList[bob.playerId]).toBeUndefined();
    expect(room?.currentPlayerCount).toBe(1);
  });

  it('keeps ownership with a player who is only away', async () => {
    const owner = await harness.connect();
    const guest = await harness.connect();
    const roomId = await createRoom(owner, { ownerUsername: 'Ada' });
    await joinRoom(owner, roomId, 'Ada');
    await joinRoom(guest, roomId, 'Grace');

    const returned = await harness.reload(owner);
    await settle(200);

    expect(harness.server.rooms[roomId]?.owner.playerId).toBe(
      returned.playerId,
    );
    expect(harness.server.rooms[roomId]?.owner.username).toBe('Ada');
  });

  it('hands ownership on only once the grace period expires', async () => {
    const owner = await harness.connect();
    const guest = await harness.connect();
    const roomId = await createRoom(owner, { ownerUsername: 'Ada' });
    await joinRoom(owner, roomId, 'Ada');
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
    const roomId = await createRoom(alice, { ownerUsername: 'Alice' });
    await joinRoom(alice, roomId, 'Alice');
    await joinRoom(bob, roomId, 'Bob');

    bob.emit('clientLeaveDrawAndGuessRoom', roomId, 'Bob');
    await settle(200);

    const room = harness.server.rooms[roomId];
    expect(room?.playerList[bob.playerId]).toBeUndefined();
    expect(room?.currentPlayerCount).toBe(1);
  });

  it('tells the room when a player drops and when they come back', async () => {
    const alice = await harness.connect();
    const bob = await harness.connect();
    const roomId = await createRoom(alice, { ownerUsername: 'Alice' });
    await joinRoom(alice, roomId, 'Alice');
    await joinRoom(bob, roomId, 'Bob');
    await settle();

    const messages = collect<[string, string]>(alice, 'receiveMessage');
    await harness.reload(bob);
    await settle(200);

    const text = messages.map(([, message]) => message).join(' | ');
    expect(text).toContain('Bob lost connection');
    expect(text).toContain('Bob reconnected');
    // Not a departure: nobody should be told Bob left.
    expect(text).not.toContain('has left the room');
  });

  /*
   * A drawer who reloads used to lose their turn, and had to: the canvas lived
   * only in the clients' memory, so they would have come back to a blank board
   * with nothing worth resuming. The drawing is on the server now, so the turn
   * waits — briefly — and they pick up where they left off, word and all.
   */
  it('gives a reloaded drawer their turn, their word and their drawing back', async () => {
    await harness.teardown();
    harness = await startTestServer({
      wordSelecting: 0.2,
      drawing: 5,
      reviewing: 0.2,
    });

    const { roomId, drawer, word } = await playToDrawingPhase(harness);
    drawer.emit('startDrawing', roomId, { x: 4, y: 4 }, '#123456', 8);
    drawer.emit('continueDrawing', roomId, { x: 40, y: 40 }, '#123456', 8);
    await settle(50);

    const returned = await harness.reload(drawer);
    const wordAgain = waitFor<string>(
      returned,
      'drawingPhaseStartedForDrawer',
      2000,
    );
    const canvasAgain = waitFor<CanvasStroke[]>(
      returned,
      'syncWhiteboardCanvas',
      2000,
    );
    returned.emit('requestDrawAndGuessRoomState', roomId);

    expect(await wordAgain).toBe(word);
    expect(await canvasAgain).toEqual([
      {
        color: '#123456',
        size: 8,
        points: [
          { x: 4, y: 4 },
          { x: 40, y: 40 },
        ],
      },
    ]);
    expect(harness.server.rooms[roomId]?.currentDrawer).toBe(drawer.playerId);
    expect(harness.server.rooms[roomId]?.isDrawingPhase).toBe(true);
  });

  /*
   * The hold is short. A room whose drawer has actually gone should not be left
   * staring at a frozen canvas for the whole reconnect grace.
   */
  it('gives up on a drawer who does not come back inside the hold', async () => {
    await harness.teardown();
    harness = await startTestServer({
      wordSelecting: 0.2,
      drawing: 5,
      reviewing: 0.2,
      drawerHold: 0.3,
    });

    const { roomId, drawer, guesser } = await playToDrawingPhase(harness);

    const turnEnded = waitFor(guesser, 'reviewingPhaseEnded', 3000);
    const messages = collect<[string, string]>(guesser, 'receiveMessage');
    drawer.close();

    await turnEnded;
    expect(
      messages.some(([, text]) => text.includes('did not come back')),
    ).toBe(true);
    // The seat is still theirs; only the turn is gone.
    expect(
      harness.server.rooms[roomId]?.playerList[drawer.playerId],
    ).toBeDefined();
  });

  /*
   * Nothing has been invested in a turn whose word has not been chosen yet, and
   * an absent drawer will not be choosing one — so that case is still skipped
   * on the spot rather than held.
   */
  it('skips the turn of a drawer who drops before choosing a word', async () => {
    await harness.teardown();
    harness = await startTestServer({
      wordSelecting: 0.2,
      drawing: 5,
      reviewing: 0.2,
    });

    const alice = await harness.connect();
    const bob = await harness.connect();
    const carol = await harness.connect();
    const roomId = await createRoom(alice, { rounds: 1 });
    await joinRoom(alice, roomId, 'Alice');
    await joinRoom(bob, roomId, 'Bob');
    await joinRoom(carol, roomId, 'Carol');

    const byId = new Map([
      [alice.playerId, alice],
      [bob.playerId, bob],
      [carol.playerId, carol],
    ]);

    const firstTurn = waitFor<{ currentDrawer: string }>(
      alice,
      'wordSelectingPhaseStarted',
    );
    alice.emit('startDrawAndGuessGame', roomId);
    const { currentDrawer } = await firstTurn;

    const drawer = byId.get(currentDrawer)!;
    const witness = drawer === alice ? bob : alice;

    const turnEnded = waitFor(witness, 'reviewingPhaseEnded');
    drawer.close();
    await turnEnded;

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
    const roomId = await createRoom(alice, { rounds: 1 });
    await joinRoom(alice, roomId, 'Alice');
    await joinRoom(bob, roomId, 'Bob');
    await joinRoom(carol, roomId, 'Carol');

    const drawers = collect<{ currentDrawer: string }>(
      alice,
      'wordSelectingPhaseStarted',
    );

    // Carol drops before the game starts and never comes back.
    carol.close();
    await settle(100);

    alice.emit('startDrawAndGuessGame', roomId);
    await waitFor(alice, 'endDrawAndGuessGame', 9000);

    expect(drawers.map((turn) => turn.currentDrawer)).not.toContain(
      carol.playerId,
    );
  });

  it('lets a returning player chat and guess again', async () => {
    const alice = await harness.connect();
    const bob = await harness.connect();
    const roomId = await createRoom(alice, { ownerUsername: 'Alice' });
    await joinRoom(alice, roomId, 'Alice');
    await joinRoom(bob, roomId, 'Bob');

    const returned = await harness.reload(bob);
    await settle(200);

    const heard = waitFor<[string, string]>(alice, 'receiveMessage');
    returned.emit('sendMessage', roomId, 'Bob', 'back again');

    expect(await heard).toEqual(['Bob', 'back again']);
  });

  it('does not let a returning player take somebody else s seat', async () => {
    const alice = await harness.connect();
    const bob = await harness.connect();
    const roomId = await createRoom(alice, { ownerUsername: 'Alice' });
    await joinRoom(alice, roomId, 'Alice');
    await joinRoom(bob, roomId, 'Bob');

    // A third client claims Alice's id with a token it invented.
    const impostor = await harness.connect({
      playerId: alice.playerId,
      token: '0'.repeat(64),
    });
    impostor.emit('sendMessage', roomId, 'Alice', 'I am Alice');
    await settle();

    expect(impostor.playerId).not.toBe(alice.playerId);
    expect(harness.server.rooms[roomId]?.owner.playerId).toBe(alice.playerId);
    expect(
      harness.server.rooms[roomId]?.playerList[alice.playerId]?.isConnected,
    ).toBe(true);
  });
});
