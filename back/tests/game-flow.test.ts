import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Socket } from 'socket.io-client';
import type { DrawAndGuessRoomState } from '../models/types.js';
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

interface Phase {
  phaseEndsInMs: number;
}

/**
 * A room with two players in it, plus a way to find out which of them the
 * server picked to draw. The drawer is chosen at random, so no test may assume
 * it is a particular client.
 */
const seatTwoPlayers = async (harness: TestServer) => {
  const alice = await harness.connect();
  const bob = await harness.connect();

  const roomId = await createRoom(alice, {
    roomName: 'Game',
    ownerUsername: 'Alice',
    rounds: 1,
  });
  await joinRoom(alice, roomId, 'Alice');
  await joinRoom(bob, roomId, 'Bob');

  const named = new Map<Socket, string>([
    [alice, 'Alice'],
    [bob, 'Bob'],
  ]);

  /** Waits for the word-selecting phase and reports whose turn it is. */
  const awaitTurn = async () => {
    const choicesFor = new Map<Socket, string[]>();
    const onChoices = (socket: Socket) => (choices: string[]) =>
      choicesFor.set(socket, choices);
    const aliceHandler = onChoices(alice);
    const bobHandler = onChoices(bob);
    alice.on('drawerReceiveWordChoices', aliceHandler);
    bob.on('drawerReceiveWordChoices', bobHandler);

    const started = await waitFor<
      Phase & { currentDrawer: string; drawerQueue: string[] }
    >(alice, 'wordSelectingPhaseStarted');
    await settle(50);

    alice.off('drawerReceiveWordChoices', aliceHandler);
    bob.off('drawerReceiveWordChoices', bobHandler);

    const [drawer, choices] = [...choicesFor.entries()][0] ?? [];
    const guesser = drawer === alice ? bob : alice;

    return {
      started,
      drawer: drawer!,
      drawerName: named.get(drawer!)!,
      guesser,
      guesserName: named.get(guesser)!,
      choices: choices!,
      /** How many of the two clients were offered word choices. */
      offeredChoicesCount: choicesFor.size,
    };
  };

  return { alice, bob, roomId, awaitTurn };
};

describe('the game engine', () => {
  let harness: TestServer;

  beforeEach(async () => {
    harness = await startTestServer();
  });

  afterEach(async () => {
    await harness.teardown();
  });

  it('refuses to start with fewer than two players', async () => {
    const owner = await harness.connect();
    const roomId = await createRoom(owner);
    await joinRoom(owner, roomId, 'Alone');

    const error = waitFor<{ errorType: string }>(owner, 'roomError');
    owner.emit('startDrawAndGuessGame', roomId);

    expect((await error).errorType).toBe('notEnoughPlayers');
    expect(harness.server.rooms[roomId]?.isGameStarted).toBe(false);
  });

  /*
   * The Start button is owner-only in the UI and, until now, nowhere else: any
   * connected client could start any room's game with a room id off the lobby
   * broadcast — including a room it had never joined.
   */
  it('refuses to start a game for anybody but the room owner', async () => {
    const { bob, roomId } = await seatTwoPlayers(harness);

    const error = waitFor<{ errorType: string }>(bob, 'roomError');
    bob.emit('startDrawAndGuessGame', roomId);

    expect((await error).errorType).toBe('notRoomOwner');
    expect(harness.server.rooms[roomId]?.isGameStarted).toBe(false);
  });

  it('refuses to start a game for a client that is not even in the room', async () => {
    const { alice, roomId } = await seatTwoPlayers(harness);
    const outsider = await harness.connect();

    const started = collect(alice, 'startDrawAndGuessGameSuccess');
    const error = waitFor<{ errorType: string }>(outsider, 'roomError');
    outsider.emit('startDrawAndGuessGame', roomId);

    expect((await error).errorType).toBe('notRoomOwner');
    await settle();
    expect(started).toEqual([]);
    expect(harness.server.rooms[roomId]?.isGameStarted).toBe(false);
  });

  it('refuses to start a game that is already running', async () => {
    const { alice, roomId } = await seatTwoPlayers(harness);
    alice.emit('startDrawAndGuessGame', roomId);
    await waitFor(alice, 'startDrawAndGuessGameSuccess');

    const error = waitFor<{ errorType: string }>(alice, 'roomError');
    alice.emit('startDrawAndGuessGame', roomId);

    expect((await error).errorType).toBe('gameAlreadyStarted');
  });

  it('opens with a word-selecting phase and a countdown', async () => {
    const { alice, roomId, awaitTurn } = await seatTwoPlayers(harness);
    const turn = awaitTurn();
    alice.emit('startDrawAndGuessGame', roomId);

    const { started, choices, offeredChoicesCount } = await turn;

    expect(started.phaseEndsInMs).toBeGreaterThan(0);
    expect(started.currentDrawer).toBeTruthy();
    expect(choices).toHaveLength(3);
    expect(new Set(choices).size).toBe(3);
    // The choices go to the drawer alone, not to the room.
    expect(offeredChoicesCount).toBe(1);
  });

  it('sends the word to the drawer alone, and a hint to everyone else', async () => {
    const { alice, roomId, awaitTurn } = await seatTwoPlayers(harness);
    const turn = awaitTurn();
    alice.emit('startDrawAndGuessGame', roomId);
    const { drawer, guesser, choices } = await turn;

    const guesserSaw = collect(guesser, 'drawingPhaseStarted');
    const drawerWord = waitFor<string>(drawer, 'drawingPhaseStartedForDrawer');
    const drawerPrivate = collect(guesser, 'drawingPhaseStartedForDrawer');

    drawer.emit('drawerSelectWordFinished', roomId, choices[0]);

    expect(await drawerWord).toBe(choices[0]);
    await settle();

    expect(drawerPrivate).toEqual([]);
    expect(JSON.stringify(guesserSaw)).not.toContain(choices[0]);
    expect(guesserSaw[0]).toMatchObject({
      isDrawingPhase: true,
      currentWordHint: '_'.repeat(choices[0]!.replace(/\s/g, '').length),
    });
  });

  it('ignores a word the drawer was not offered', async () => {
    const { alice, roomId, awaitTurn } = await seatTwoPlayers(harness);
    const turn = awaitTurn();
    alice.emit('startDrawAndGuessGame', roomId);
    const { drawer } = await turn;

    drawer.emit('drawerSelectWordFinished', roomId, 'not-a-choice');
    await settle(50);

    expect(harness.server.rooms[roomId]?.isDrawingPhase).toBe(false);
    expect(harness.server.rooms[roomId]?.isWordSelectingPhase).toBe(true);
  });

  it('ignores a word chosen by somebody who is not the drawer', async () => {
    const { alice, roomId, awaitTurn } = await seatTwoPlayers(harness);
    const turn = awaitTurn();
    alice.emit('startDrawAndGuessGame', roomId);
    const { guesser, choices } = await turn;

    guesser.emit('drawerSelectWordFinished', roomId, choices[0]);
    await settle();

    expect(harness.server.rooms[roomId]?.isDrawingPhase).toBe(false);
  });

  /*
   * The fallback used to be the drawer's browser's job, so it never happened
   * if they had closed the tab — the room sat in the selecting phase forever.
   */
  it('picks a word itself when the drawer never chooses one', async () => {
    const { alice, roomId, awaitTurn } = await seatTwoPlayers(harness);
    const turn = awaitTurn();
    alice.emit('startDrawAndGuessGame', roomId);
    const { drawer, choices } = await turn;

    const drawing = waitFor<Phase>(alice, 'drawingPhaseStarted');
    const word = waitFor<string>(drawer, 'drawingPhaseStartedForDrawer');

    // Nobody chooses. The server's own clock has to move the phase on.
    expect((await drawing).phaseEndsInMs).toBeGreaterThan(0);
    expect(choices).toContain(await word);
  });

  it('runs a whole turn on its own clock, ending with the word revealed', async () => {
    const { alice, roomId, awaitTurn } = await seatTwoPlayers(harness);
    const turn = awaitTurn();
    alice.emit('startDrawAndGuessGame', roomId);
    const { drawer, choices } = await turn;

    const reviewing = waitFor<Phase & { currentWord: string }>(
      alice,
      'reviewingPhaseStarted',
    );
    drawer.emit('drawerSelectWordFinished', roomId, choices[0]);

    const reveal = await reviewing;
    expect(reveal.currentWord).toBe(choices[0]);
    expect(reveal.phaseEndsInMs).toBeGreaterThan(0);

    // ...and the turn ends without any client asking it to.
    await waitFor(alice, 'reviewingPhaseEnded');
  });

  /*
   * The hint used to be the same row of underscores for the whole phase. It
   * now gives up to a third of the letters away as the clock runs down, which
   * is what rescues a room that has stalled on a hard word.
   */
  it('uncovers letters of the word as the drawing clock runs down', async () => {
    const harnessWithHints = await startTestServer({
      wordSelecting: 0.2,
      drawing: 1.5,
      reviewing: 0.2,
    });
    try {
      const { guesser, word } = await playToDrawingPhase(harnessWithHints);
      const hints = collect<{ currentWordHint: string }>(
        guesser,
        'wordHintRevealed',
      );

      // Long enough for both reveals — at a third and two thirds of the phase.
      await settle(1300);

      // The shortest word in the bank is three letters, so every word gets at
      // least one letter given away.
      expect(hints.length).toBeGreaterThan(0);

      const shown = (hint: string) =>
        [...hint].filter((char) => char !== '_' && char.trim() !== '').length;
      const letterCount = [...word].filter((char) => char.trim() !== '').length;

      let previouslyShown = 0;
      for (const { currentWordHint } of hints) {
        expect(currentWordHint).toHaveLength(word.length);
        // Every character is either still hidden or the word's own.
        for (const [index, char] of [...currentWordHint].entries()) {
          expect(char === '_' || char === word[index]).toBe(true);
        }
        // It only ever gets easier, and never gives the whole word away.
        expect(shown(currentWordHint)).toBeGreaterThanOrEqual(previouslyShown);
        previouslyShown = shown(currentWordHint);
      }

      expect(previouslyShown).toBeGreaterThan(0);
      expect(previouslyShown).toBe(Math.floor(letterCount / 3));
    } finally {
      await harnessWithHints.teardown();
    }
  });

  /*
   * A reveal scheduled for a turn that ended early must not go off during the
   * reveal that replaced it — the word is on screen by then, and a hint
   * arriving after it is at best noise.
   */
  it('stops hinting once the turn is over', async () => {
    const harnessWithHints = await startTestServer({
      wordSelecting: 0.2,
      drawing: 1.2, // reveals would be due at 0.4s and 0.8s
      reviewing: 2, // ...which land inside this, if they were still pending
    });
    try {
      const { roomId, guesser, guesserName, word } =
        await playToDrawingPhase(harnessWithHints);

      const hints = collect(guesser, 'wordHintRevealed');
      // The only guesser guesses, so the phase ends before any reveal is due.
      guesser.emit('takingAGuess', roomId, guesserName, word);
      await waitFor(guesser, 'reviewingPhaseStarted', 1000);

      await settle(1000);

      expect(hints).toEqual([]);
    } finally {
      await harnessWithHints.teardown();
    }
  });

  it('plays every player once per round, then ends the game', async () => {
    const { alice, roomId, awaitTurn } = await seatTwoPlayers(harness);
    const turn = awaitTurn();
    const ended = waitFor<DrawAndGuessRoomState>(
      alice,
      'endDrawAndGuessGame',
      9000,
    );
    const drawers = collect<{ currentDrawer: string }>(
      alice,
      'wordSelectingPhaseStarted',
    );

    alice.emit('startDrawAndGuessGame', roomId);
    await turn;

    const finalState = await ended;
    expect(drawers).toHaveLength(2);
    expect(new Set(drawers.map((d) => d.currentDrawer)).size).toBe(2);
    expect(finalState.isGameStarted).toBe(false);
    expect(finalState.status).toBe('Open');
    expect(harness.server.rooms[roomId]?.phaseEndsAt).toBe(0);
  });

  /*
   * The reason the clock had to move to the server at all. The drawer's tab
   * owned the phase timer, so closing it left everyone else waiting forever.
   */
  /*
   * The seat waits for a dropped player; the turn does not. A drawer who is not
   * there cannot draw, and holding the room still for the whole grace period
   * would cost everyone else more than it saves the one who dropped.
   */
  it('skips to the next turn as soon as the drawer drops', async () => {
    const harness3 = await startTestServer();
    try {
      const [alice, bob, carol] = await Promise.all([
        harness3.connect(),
        harness3.connect(),
        harness3.connect(),
      ]);
      const roomId = await createRoom(alice, { rounds: 1 });
      await joinRoom(alice, roomId, 'Alice');
      await joinRoom(bob, roomId, 'Bob');
      await joinRoom(carol, roomId, 'Carol');

      const clients = new Map([
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

      const witness = currentDrawer === alice.playerId ? bob : alice;
      const turnEnded = waitFor(witness, 'reviewingPhaseEnded');
      const messages = collect<[string, string]>(witness, 'receiveMessage');

      clients.get(currentDrawer)!.close();

      await turnEnded;
      expect(
        messages.some(([, text]) => text.includes('drawer lost connection')),
      ).toBe(true);
      expect(harness3.server.rooms[roomId]?.isGameStarted).toBe(true);
    } finally {
      await harness3.teardown();
    }
  });

  it('ends the game when too few players are left to continue', async () => {
    const { alice, bob, roomId, awaitTurn } = await seatTwoPlayers(harness);
    const turn = awaitTurn();
    alice.emit('startDrawAndGuessGame', roomId);
    await turn;

    const ended = waitFor<DrawAndGuessRoomState>(alice, 'endDrawAndGuessGame');
    bob.close();

    const finalState = await ended;
    expect(finalState.isGameStarted).toBe(false);
    expect(finalState.currentDrawer).toBe('');
    expect(harness.server.rooms[roomId]?.phaseEndsAt).toBe(0);
  });

  /*
   * A pending phase timer that fires against a deleted room used to be the
   * shape of a crash; the engine drops it with the room instead.
   */
  it('drops a pending phase timer when the room is deleted mid-turn', async () => {
    const { alice, bob, roomId, awaitTurn } = await seatTwoPlayers(harness);
    const turn = awaitTurn();
    alice.emit('startDrawAndGuessGame', roomId);
    await turn;

    alice.close();
    bob.close();
    // Long enough for both seats to expire and the empty room to be collected.
    await settle(1200);

    expect(harness.server.rooms[roomId]).toBeUndefined();
  });
});
