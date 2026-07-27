import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  collect,
  createRoom,
  joinRoom,
  playToDrawingPhase,
  settle,
  startTestServer,
  waitFor,
  type ScoresPayload,
  type TestClient,
  type TestServer,
} from './helpers/test-server.js';

/**
 * Three players in a drawing phase: one drawing and two still guessing, which
 * is the smallest room where "everybody has guessed" is not the same event as
 * "somebody has guessed".
 */
const playToDrawingPhaseWithThree = async (harness: TestServer) => {
  const names = ['Alice', 'Bob', 'Carol'];
  const [alice, bob, carol] = await Promise.all([
    harness.connect(),
    harness.connect(),
    harness.connect(),
  ]);
  const clients = [alice!, bob!, carol!];

  const roomId = await createRoom(alice!, { ownerUsername: 'Alice' });
  for (const [index, client] of clients.entries()) {
    await joinRoom(client, roomId, names[index]!);
  }

  let drawer: TestClient | undefined;
  let word: string | undefined;
  for (const client of clients) {
    client.once('dg:word', (received: string) => {
      drawer = client;
      word = received;
    });
  }

  const drawing = waitFor(alice!, 'dg:phase:drawing', 5000);
  alice!.emit('game:start', roomId);
  await drawing;
  await settle(50);

  return {
    roomId,
    drawer: drawer!,
    guessers: clients.filter((client) => client !== drawer),
    guesserName: (client: TestClient) => names[clients.indexOf(client)]!,
    word: word!,
  };
};

/*
 * Every check below is about what the *server* permits. The UI already disables
 * the guess box for the drawer and for anyone who has scored, and only routes a
 * message during the drawing phase — but none of that binds a modified client,
 * and until this pass none of it was checked on arrival.
 */
describe('guess authority', () => {
  let harness: TestServer;

  beforeEach(async () => {
    // Long enough to make the assertions inside a single drawing phase.
    harness = await startTestServer({
      wordSelecting: 0.2,
      drawing: 5,
      reviewing: 0.2,
    });
  });

  afterEach(async () => {
    await harness.teardown();
  });

  it('awards points for a correct guess, ignoring case and padding', async () => {
    const { roomId, guesser, guesserName, drawer, word } =
      await playToDrawingPhase(harness);

    const scored = waitFor<ScoresPayload>(drawer, 'dg:scores');
    const announced = waitFor<[string, string]>(drawer, 'dg:guess:correct');
    guesser.emit('dg:guess', roomId, guesserName, ` ${word.toUpperCase()} `);

    const players = (await scored).playerList;
    const scores = Object.values(players)
      .map((player) => player.points)
      .toSorted((a, b) => b - a);
    // Guessed at once, so near the top of the range: the guesser takes the
    // floor plus almost the whole bonus, and the drawer two fifths of that.
    expect(scores[0]).toBeGreaterThan(140);
    expect(scores[1]).toBe(Math.round(scores[0]! * 0.4));
    expect((await announced)[1]).toContain(guesserName);
    expect((await announced)[1]).toContain(`+${scores[0]}`);
  });

  it('does not leak the word by echoing a wrong guess back as a hint', async () => {
    const { roomId, guesser, guesserName, drawer } =
      await playToDrawingPhase(harness);

    const drawerHeard = collect<[string, string]>(drawer, 'chat:message');
    guesser.emit('dg:guess', roomId, guesserName, 'definitely wrong');
    await settle();

    expect(drawerHeard).toContainEqual([guesserName, 'definitely wrong']);
  });

  it('refuses to let the drawer score by guessing their own word', async () => {
    const { roomId, drawer, drawerName, word, guesser } =
      await playToDrawingPhase(harness);

    const scored = collect(guesser, 'dg:scores');
    drawer.emit('dg:guess', roomId, drawerName, word);
    await settle();

    expect(scored).toEqual([]);
    expect(
      Object.values(harness.server.rooms[roomId]!.playerList).every(
        (player) => player.points === 0,
      ),
    ).toBe(true);
  });

  /*
   * A flat 100 made a turn pass/fail rather than a race: the same score for
   * getting it in three seconds and for getting it in the last one.
   */
  it('pays a fast guess more than a slow one', async () => {
    const early = await playToDrawingPhase(harness);
    const earlyScored = waitFor<ScoresPayload>(early.drawer, 'dg:scores');
    early.guesser.emit('dg:guess', early.roomId, early.guesserName, early.word);
    const earlyPoints = (await earlyScored).playerList[early.guesser.playerId]!
      .points;

    const late = await playToDrawingPhase(harness);
    // Most of the five-second phase spent staring at the canvas.
    await settle(3500);
    const lateScored = waitFor<ScoresPayload>(late.drawer, 'dg:scores');
    late.guesser.emit('dg:guess', late.roomId, late.guesserName, late.word);
    const latePoints = (await lateScored).playerList[late.guesser.playerId]!
      .points;

    expect(earlyPoints).toBeGreaterThan(latePoints);
    // ...but getting there at all is still worth something.
    expect(latePoints).toBeGreaterThanOrEqual(50);
    expect(earlyPoints).toBeLessThanOrEqual(150);
  });

  it('refuses to let one player score twice in a turn', async () => {
    const { roomId, guesser, guesserName, drawer, word } =
      await playToDrawingPhase(harness);

    const scored = collect<ScoresPayload>(drawer, 'dg:scores');
    for (let i = 0; i < 5; i++) {
      guesser.emit('dg:guess', roomId, guesserName, word);
    }
    await settle(300);

    expect(scored).toHaveLength(1);
    expect(
      Math.max(
        ...Object.values(harness.server.rooms[roomId]!.playerList).map(
          (player) => player.points,
        ),
      ),
    ).toBeLessThanOrEqual(150);
  });

  it('refuses a guess from somebody who is not in the room', async () => {
    const { roomId, word, drawer } = await playToDrawingPhase(harness);
    const outsider = await harness.connect();

    const scored = collect(drawer, 'dg:scores');
    const heard = collect(drawer, 'chat:message');
    outsider.emit('dg:guess', roomId, 'Outsider', word);
    outsider.emit('chat:send', roomId, 'Outsider', 'let me in');
    await settle();

    expect(scored).toEqual([]);
    expect(JSON.stringify(heard)).not.toContain('Outsider');
  });

  /*
   * The reveal shows the word to the whole room. Guessing during it is
   * guessing with the answer on screen.
   */
  it('refuses a guess made outside the drawing phase', async () => {
    const alice = await harness.connect();
    const bob = await harness.connect();
    const roomId = await createRoom(alice, { rounds: 1 });
    await joinRoom(alice, roomId, 'Alice');
    await joinRoom(bob, roomId, 'Bob');

    const scored = collect(alice, 'dg:scores');

    // Before the game has started at all.
    bob.emit('dg:guess', roomId, 'Bob', 'anything');
    await settle();
    expect(scored).toEqual([]);

    // ...and during the reveal, when everyone can read the word.
    const reveal = waitFor<{ currentWord: string }>(
      alice,
      'dg:phase:review',
      9000,
    );
    alice.emit('game:start', roomId);
    const { currentWord } = await reveal;

    bob.emit('dg:guess', roomId, 'Bob', currentWord);
    alice.emit('dg:guess', roomId, 'Alice', currentWord);
    await settle();

    expect(scored).toEqual([]);
  });

  /*
   * The rest of a drawing phase whose word everyone has guessed is dead time:
   * the drawer has nothing left to draw for, and every guesser is watching a
   * countdown for a word they already know.
   */
  it('ends the turn as soon as everybody has guessed', async () => {
    const { roomId, guesser, guesserName, drawer, word } =
      await playToDrawingPhase(harness);

    const reveal = waitFor<{ currentWord: string }>(
      drawer,
      'dg:phase:review',
      1000, // far inside the five-second drawing phase
    );
    const messages = collect<[string, string]>(drawer, 'chat:message');
    guesser.emit('dg:guess', roomId, guesserName, word);

    expect((await reveal).currentWord).toBe(word);
    expect(
      messages.some(([, text]) => text.includes('Everybody guessed')),
    ).toBe(true);
  });

  it('waits for the players who have not guessed yet', async () => {
    const { roomId, drawer, guessers, guesserName, word } =
      await playToDrawingPhaseWithThree(harness);

    const ended = collect(drawer, 'dg:phase:review');
    guessers[0].emit('dg:guess', roomId, guesserName(guessers[0]), word);
    await settle(300);

    // One of the two has guessed; the other is still trying.
    expect(ended).toEqual([]);

    const reveal = waitFor<{ currentWord: string }>(
      drawer,
      'dg:phase:review',
      1000,
    );
    guessers[1].emit('dg:guess', roomId, guesserName(guessers[1]), word);

    expect((await reveal).currentWord).toBe(word);
  });

  /*
   * A player inside their reconnect grace still holds a seat but cannot guess,
   * so waiting for them would cost the room the whole rest of the phase.
   */
  it('does not wait for a player who is away', async () => {
    const { roomId, drawer, guessers, guesserName, word } =
      await playToDrawingPhaseWithThree(harness);

    guessers[1].close();
    await settle(100);
    // Still seated, just away — and so still in the room's player list.
    expect(
      harness.server.rooms[roomId]?.playerList[guessers[1].playerId]
        ?.isConnected,
    ).toBe(false);

    const reveal = waitFor<{ currentWord: string }>(
      drawer,
      'dg:phase:review',
      1000,
    );
    guessers[0].emit('dg:guess', roomId, guesserName(guessers[0]), word);

    expect((await reveal).currentWord).toBe(word);
  });

  it('passes ordinary room chat through to everyone else', async () => {
    const alice = await harness.connect();
    const bob = await harness.connect();
    const roomId = await createRoom(alice);
    await joinRoom(alice, roomId, 'Alice');
    await joinRoom(bob, roomId, 'Bob');
    // `joinRoom` resolves on the approval, which the server sends before it
    // announces the arrival to the room. Without settling first, the next
    // `receiveMessage` Bob sees can be his own "has joined" notice.
    await settle();

    const heard = waitFor<[string, string]>(bob, 'chat:message');
    alice.emit('chat:send', roomId, 'Alice', 'hello room');

    expect(await heard).toEqual(['Alice', 'hello room']);
  });
});
