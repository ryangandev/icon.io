import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Socket } from 'socket.io-client';
import type { PlayerInfo } from '../models/types.js';
import {
  collect,
  createRoom,
  joinRoom,
  settle,
  startTestServer,
  waitFor,
  type TestServer,
} from './helpers/test-server.js';

/**
 * Starts a game and plays it as far as the drawing phase, reporting who is
 * drawing, who is guessing, and what the word is.
 *
 * Every check below is about what the *server* permits. The UI already disables
 * the guess box for the drawer and for anyone who has scored, and only routes a
 * message during the drawing phase — but none of that binds a modified client,
 * and until this pass none of it was checked on arrival.
 */
const playToDrawingPhase = async (harness: TestServer) => {
  const alice = await harness.connect();
  const bob = await harness.connect();

  const roomId = await createRoom(alice, { ownerUsername: 'Alice', rounds: 1 });
  await joinRoom(alice, roomId, 'Alice');
  await joinRoom(bob, roomId, 'Bob');

  let drawer: Socket | undefined;
  let word: string | undefined;
  const learn = (socket: Socket) => (received: string) => {
    drawer = socket;
    word = received;
  };
  alice.once('drawingPhaseStartedForDrawer', learn(alice));
  bob.once('drawingPhaseStartedForDrawer', learn(bob));

  const drawing = waitFor(alice, 'drawingPhaseStarted', 5000);
  alice.emit('startDrawAndGuessGame', roomId);
  await drawing;
  await settle(50);

  const guesser = drawer === alice ? bob : alice;

  return {
    roomId,
    alice,
    bob,
    drawer: drawer!,
    drawerName: drawer === alice ? 'Alice' : 'Bob',
    guesser,
    guesserName: guesser === alice ? 'Alice' : 'Bob',
    word: word!,
  };
};

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
