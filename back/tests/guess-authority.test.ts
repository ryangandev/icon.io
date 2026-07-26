import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PlayerInfo } from '../models/types.js';
import {
  collect,
  createRoom,
  joinRoom,
  playToDrawingPhase,
  settle,
  startTestServer,
  waitFor,
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
    client.once('drawingPhaseStartedForDrawer', (received: string) => {
      drawer = client;
      word = received;
    });
  }

  const drawing = waitFor(alice!, 'drawingPhaseStarted', 5000);
  alice!.emit('startDrawAndGuessGame', roomId);
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

    const scored = waitFor<Record<string, PlayerInfo>>(
      drawer,
      'playersReceivedPointsFromCorrectGuess',
    );
    const announced = waitFor<[string, string]>(
      drawer,
      'correctGuessAnnouncement',
    );
    guesser.emit(
      'takingAGuess',
      roomId,
      guesserName,
      ` ${word.toUpperCase()} `,
    );

    const players = await scored;
    const scores = Object.values(players).map((player) => player.points);
    // The guesser takes 100 and the drawer 40.
    expect(scores).toEqual(expect.arrayContaining([100, 40]));
    expect((await announced)[1]).toContain(guesserName);
  });

  it('does not leak the word by echoing a wrong guess back as a hint', async () => {
    const { roomId, guesser, guesserName, drawer } =
      await playToDrawingPhase(harness);

    const drawerHeard = collect<[string, string]>(drawer, 'receiveMessage');
    guesser.emit('takingAGuess', roomId, guesserName, 'definitely wrong');
    await settle();

    expect(drawerHeard).toContainEqual([guesserName, 'definitely wrong']);
  });

  it('refuses to let the drawer score by guessing their own word', async () => {
    const { roomId, drawer, drawerName, word, guesser } =
      await playToDrawingPhase(harness);

    const scored = collect(guesser, 'playersReceivedPointsFromCorrectGuess');
    drawer.emit('takingAGuess', roomId, drawerName, word);
    await settle();

    expect(scored).toEqual([]);
    expect(
      Object.values(harness.server.rooms[roomId]!.playerList).every(
        (player) => player.points === 0,
      ),
    ).toBe(true);
  });

  it('refuses to let one player score twice in a turn', async () => {
    const { roomId, guesser, guesserName, drawer, word } =
      await playToDrawingPhase(harness);

    const scored = collect<Record<string, PlayerInfo>>(
      drawer,
      'playersReceivedPointsFromCorrectGuess',
    );
    for (let i = 0; i < 5; i++) {
      guesser.emit('takingAGuess', roomId, guesserName, word);
    }
    await settle(300);

    expect(scored).toHaveLength(1);
    expect(
      Math.max(
        ...Object.values(harness.server.rooms[roomId]!.playerList).map(
          (player) => player.points,
        ),
      ),
    ).toBe(100);
  });

  it('refuses a guess from somebody who is not in the room', async () => {
    const { roomId, word, drawer } = await playToDrawingPhase(harness);
    const outsider = await harness.connect();

    const scored = collect(drawer, 'playersReceivedPointsFromCorrectGuess');
    const heard = collect(drawer, 'receiveMessage');
    outsider.emit('takingAGuess', roomId, 'Outsider', word);
    outsider.emit('sendMessage', roomId, 'Outsider', 'let me in');
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

    const scored = collect(alice, 'playersReceivedPointsFromCorrectGuess');

    // Before the game has started at all.
    bob.emit('takingAGuess', roomId, 'Bob', 'anything');
    await settle();
    expect(scored).toEqual([]);

    // ...and during the reveal, when everyone can read the word.
    const reveal = waitFor<{ currentWord: string }>(
      alice,
      'reviewingPhaseStarted',
      9000,
    );
    alice.emit('startDrawAndGuessGame', roomId);
    const { currentWord } = await reveal;

    bob.emit('takingAGuess', roomId, 'Bob', currentWord);
    alice.emit('takingAGuess', roomId, 'Alice', currentWord);
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
      'reviewingPhaseStarted',
      1000, // far inside the five-second drawing phase
    );
    const messages = collect<[string, string]>(drawer, 'receiveMessage');
    guesser.emit('takingAGuess', roomId, guesserName, word);

    expect((await reveal).currentWord).toBe(word);
    expect(
      messages.some(([, text]) => text.includes('Everybody guessed')),
    ).toBe(true);
  });

  it('waits for the players who have not guessed yet', async () => {
    const { roomId, drawer, guessers, guesserName, word } =
      await playToDrawingPhaseWithThree(harness);

    const ended = collect(drawer, 'reviewingPhaseStarted');
    guessers[0].emit('takingAGuess', roomId, guesserName(guessers[0]), word);
    await settle(300);

    // One of the two has guessed; the other is still trying.
    expect(ended).toEqual([]);

    const reveal = waitFor<{ currentWord: string }>(
      drawer,
      'reviewingPhaseStarted',
      1000,
    );
    guessers[1].emit('takingAGuess', roomId, guesserName(guessers[1]), word);

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
      'reviewingPhaseStarted',
      1000,
    );
    guessers[0].emit('takingAGuess', roomId, guesserName(guessers[0]), word);

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

    const heard = waitFor<[string, string]>(bob, 'receiveMessage');
    alice.emit('sendMessage', roomId, 'Alice', 'hello room');

    expect(await heard).toEqual(['Alice', 'hello room']);
  });
});
