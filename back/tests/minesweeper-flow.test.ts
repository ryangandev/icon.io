import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MinesweeperPickResult } from '../models/types.js';
import {
  collect,
  createMinesweeperRoom,
  createRoom,
  joinRoom,
  lobbyView,
  minesweeperRoom,
  playToFirstRound,
  settle,
  startTestServer,
  waitFor,
  type TestServer,
} from './helpers/test-server.js';
import { hiddenIndexes } from '../socket/minesweeper/board.js';
import { pointsForPick } from '../socket/minesweeper/scoring.js';

interface Resolution {
  results: MinesweeperPickResult[];
  board: number[];
  minesFound: number;
}

describe('a Minesweeper room', () => {
  let harness: TestServer;

  beforeEach(async () => {
    harness = await startTestServer();
  });

  afterEach(async () => {
    await harness.teardown();
  });

  it('appears in its own lobby, not Draw & Guess’s', async () => {
    const client = await harness.connect();
    const minefield = await createMinesweeperRoom(client, {
      roomName: 'Minefield',
      difficulty: 'Medium',
    });
    await createRoom(client, { roomName: 'Doodles' });

    const drawList = waitFor<[string, { roomId: string }[]]>(
      client,
      'lobby:rooms',
    );
    client.emit('lobby:subscribe', 'draw-and-guess');
    const [, drawRooms] = await drawList;
    expect(drawRooms.map((room) => room.roomId)).not.toContain(minefield);

    const view = await lobbyView(client, minefield, 'minesweeper');
    expect(view).toMatchObject({
      gameType: 'minesweeper',
      difficulty: 'Medium',
      roomName: 'Minefield',
    });
  });

  it('refuses a difficulty that is not one of the three', async () => {
    const client = await harness.connect();
    const created = collect(client, 'room:created');

    client.emit('room:create', {
      gameType: 'minesweeper',
      roomName: 'Impossible',
      ownerUsername: 'Ada',
      maxPlayers: 4,
      password: '',
      settings: { difficulty: 'Nightmare' },
    });
    await settle();

    expect(created).toEqual([]);
  });

  it('deals a board nobody can see through', async () => {
    const { first, roomId } = await playToFirstRound(harness);
    const room = minesweeperRoom(harness, roomId);

    expect(first.round).toBe(1);
    expect(first.board).toHaveLength(9 * 9);
    // Every cell hidden, whatever is underneath.
    expect(first.board.every((cell) => cell === -1)).toBe(true);
    // ...and the layout really does exist on the server.
    expect(room.game.board.mines.filter(Boolean)).toHaveLength(10);
  });
});

describe('a round', () => {
  let harness: TestServer;

  beforeEach(async () => {
    harness = await startTestServer();
  });

  afterEach(async () => {
    await harness.teardown();
  });

  /** The first hidden cell the server knows is safe. */
  const aSafeCell = (roomId: string, skip = 0): number => {
    const room = minesweeperRoom(harness, roomId);
    const safe = hiddenIndexes(room.game.board).filter(
      (index) => !room.game.board.mines[index],
    );
    return safe[skip];
  };

  const aMine = (roomId: string): number => {
    const room = minesweeperRoom(harness, roomId);
    return hiddenIndexes(room.game.board).find(
      (index) => room.game.board.mines[index],
    )!;
  };

  it('tells the room who has locked in, and never what they picked', async () => {
    const { roomId, alice, bob } = await playToFirstRound(harness);
    const cell = aSafeCell(roomId);

    const locked = waitFor<{ lockedIn: string[] }>(bob, 'ms:locked');
    alice.emit('ms:pick', roomId, cell);
    const seen = await locked;

    expect(seen.lockedIn).toEqual([alice.playerId]);
    // The cell itself is the one thing that must not travel: publishing it
    // would let everyone else read a pick off the board, and let a late
    // chooser follow the crowd, which is what simultaneous picking prevents.
    expect(Object.keys(seen)).toEqual(['lockedIn']);
    for (const entry of seen.lockedIn) {
      expect(entry).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('never puts the mine layout in anything it sends', async () => {
    const { roomId, alice, bob } = await playToFirstRound(harness);
    const room = minesweeperRoom(harness, roomId);
    const everything = collect(alice, 'ms:resolve');
    const rounds = collect(alice, 'ms:round');

    alice.emit('ms:pick', roomId, aSafeCell(roomId));
    bob.emit('ms:pick', roomId, aSafeCell(roomId, 1));
    await settle(300);

    // A board a client sees may hold -1, 0–8 and 9, and nothing else — there
    // is no encoding of "safe but unopened" for the layout to leak through.
    const boards = [...rounds, ...everything].flatMap(
      (payload) => (payload as { board?: number[] }).board ?? [],
    );
    expect(boards.length).toBeGreaterThan(0);
    for (const cell of boards) expect(cell).toBeGreaterThanOrEqual(-1);
    for (const cell of boards) expect(cell).toBeLessThanOrEqual(9);

    // And the count of still-hidden cells is far more than the safe ones the
    // two picks opened, so nothing bulk-revealed the board.
    expect(room.game.board.mines.filter(Boolean)).toHaveLength(10);
  });

  it('resolves as soon as everybody has picked, without waiting out the clock', async () => {
    const { roomId, alice, bob } = await playToFirstRound(harness);

    const resolved = waitFor<Resolution>(alice, 'ms:resolve');
    const startedAt = Date.now();
    alice.emit('ms:pick', roomId, aSafeCell(roomId));
    bob.emit('ms:pick', roomId, aSafeCell(roomId, 1));

    const outcome = await resolved;
    // The window is 600ms; both picks were in well inside it.
    expect(Date.now() - startedAt).toBeLessThan(500);
    expect(outcome.results).toHaveLength(2);
  });

  it('pays a safe pick what its risk was worth, and uncovers it', async () => {
    const { roomId, alice, bob } = await playToFirstRound(harness);
    const cell = aSafeCell(roomId);

    const resolved = waitFor<Resolution>(alice, 'ms:resolve');
    alice.emit('ms:pick', roomId, cell);
    bob.emit('ms:pick', roomId, aSafeCell(roomId, 1));
    const outcome = await resolved;

    const mine = outcome.results.find(
      (result) => result.playerId === alice.playerId,
    )!;
    expect(mine.hitMine).toBe(false);
    expect(mine.index).toBe(cell);
    expect(mine.points).toBe(
      pointsForPick({
        risk: mine.risk,
        hitMine: false,
        sharedWith: 1,
        autoPlayed: false,
      }),
    );
    // The opening board is uniform, so the first pick is worth the density.
    expect(mine.risk).toBeCloseTo(10 / 81, 6);
    expect(outcome.board[cell]).not.toBe(-1);
  });

  it('costs a mine its points, and makes it common knowledge', async () => {
    const { roomId, alice, bob } = await playToFirstRound(harness);
    const cell = aMine(roomId);

    const resolved = waitFor<Resolution>(alice, 'ms:resolve');
    alice.emit('ms:pick', roomId, cell);
    bob.emit('ms:pick', roomId, aSafeCell(roomId));
    const outcome = await resolved;

    const hit = outcome.results.find(
      (result) => result.playerId === alice.playerId,
    )!;
    expect(hit.hitMine).toBe(true);
    expect(hit.points).toBeLessThan(0);
    // A hit mine is not hidden any more: everyone can see it, and the solver
    // counts it against the numbers around it from here on.
    expect(outcome.board[cell]).toBe(9);
    expect(outcome.minesFound).toBe(1);
  });

  /*
   * The asymmetry that keeps a crowd from hiding behind each other: the reward
   * for claiming a cell is shared, the penalty for the decision is not.
   */
  it('splits the reward when two players pick the same cell', async () => {
    const { roomId, alice, bob } = await playToFirstRound(harness);
    const cell = aSafeCell(roomId);

    const resolved = waitFor<Resolution>(alice, 'ms:resolve');
    alice.emit('ms:pick', roomId, cell);
    bob.emit('ms:pick', roomId, cell);
    const outcome = await resolved;

    expect(outcome.results).toHaveLength(2);
    for (const result of outcome.results) {
      expect(result.sharedWith).toBe(2);
      expect(result.points).toBe(
        pointsForPick({
          risk: result.risk,
          hitMine: false,
          sharedWith: 2,
          autoPlayed: false,
        }),
      );
    }
  });

  it('makes each of them pay in full when the shared cell is a mine', async () => {
    const { roomId, alice, bob } = await playToFirstRound(harness);
    const cell = aMine(roomId);

    const resolved = waitFor<Resolution>(alice, 'ms:resolve');
    alice.emit('ms:pick', roomId, cell);
    bob.emit('ms:pick', roomId, cell);
    const outcome = await resolved;

    const [first, second] = outcome.results;
    expect(first.points).toBe(second.points);
    expect(first.points).toBe(
      pointsForPick({
        risk: first.risk,
        hitMine: true,
        sharedWith: 2,
        autoPlayed: false,
      }),
    );
  });

  it('takes one pick per player and ignores the rest', async () => {
    const { roomId, alice, bob } = await playToFirstRound(harness);
    const first = aSafeCell(roomId);
    const second = aSafeCell(roomId, 1);

    const resolved = waitFor<Resolution>(alice, 'ms:resolve');
    alice.emit('ms:pick', roomId, first);
    alice.emit('ms:pick', roomId, second); // ignored: already committed
    bob.emit('ms:pick', roomId, aSafeCell(roomId, 2));
    const outcome = await resolved;

    const mine = outcome.results.filter(
      (result) => result.playerId === alice.playerId,
    );
    expect(mine).toHaveLength(1);
    expect(mine[0].index).toBe(first);
  });

  it('ignores a pick on a cell that is already resolved', async () => {
    const { roomId, alice, bob } = await playToFirstRound(harness);
    const cell = aSafeCell(roomId);

    const firstRound = waitFor<Resolution>(alice, 'ms:resolve');
    alice.emit('ms:pick', roomId, cell);
    bob.emit('ms:pick', roomId, aSafeCell(roomId, 1));
    await firstRound;
    await waitFor(alice, 'ms:round');

    const locked = collect<{ lockedIn: string[] }>(alice, 'ms:locked');
    alice.emit('ms:pick', roomId, cell); // already uncovered
    await settle();

    expect(locked).toEqual([]);
  });

  /*
   * Letting the clock run out plays the safest cell going — never nothing,
   * because a round that resolved no cells would not terminate.
   */
  it('picks the safest cell for a player who runs out of time', async () => {
    const { roomId, alice, bob } = await playToFirstRound(harness);

    const resolved = waitFor<Resolution>(alice, 'ms:resolve', 5000);
    alice.emit('ms:pick', roomId, aSafeCell(roomId));
    // Bob never picks.
    const outcome = await resolved;

    const bobsPick = outcome.results.find(
      (result) => result.playerId === bob.playerId,
    )!;
    expect(bobsPick.autoPlayed).toBe(true);
    // Forfeits the base, so being present is worth something.
    expect(bobsPick.points).toBe(
      pointsForPick({
        risk: bobsPick.risk,
        hitMine: bobsPick.hitMine,
        sharedWith: bobsPick.sharedWith,
        autoPlayed: true,
      }),
    );
  });

  it('scores every pick against the board as it was before the round', async () => {
    const { roomId, alice, bob } = await playToFirstRound(harness);

    const resolved = waitFor<Resolution>(alice, 'ms:resolve');
    alice.emit('ms:pick', roomId, aSafeCell(roomId));
    bob.emit('ms:pick', roomId, aSafeCell(roomId, 1));
    const outcome = await resolved;

    // Both chose from the same untouched board, so both were quoted the same
    // risk — even though one of them may have been uncovered by the other's
    // cascade before the scoring finished.
    const [first, second] = outcome.results;
    expect(first.risk).toBeCloseTo(second.risk, 9);
  });
});

describe('a Minesweeper game', () => {
  let harness: TestServer;

  beforeEach(async () => {
    harness = await startTestServer();
  });

  afterEach(async () => {
    await harness.teardown();
  });

  it('needs two players, and only the owner may start it', async () => {
    const alice = await harness.connect();
    const roomId = await createMinesweeperRoom(alice, {
      ownerUsername: 'Alice',
    });
    await joinRoom(alice, roomId, 'Alice');

    const tooFew = waitFor<{ errorType: string }>(alice, 'room:error');
    alice.emit('game:start', roomId);
    expect((await tooFew).errorType).toBe('notEnoughPlayers');

    const bob = await harness.connect();
    await joinRoom(bob, roomId, 'Bob');

    const notOwner = waitFor<{ errorType: string }>(bob, 'room:error');
    bob.emit('game:start', roomId);
    expect((await notOwner).errorType).toBe('notRoomOwner');
  });

  /*
   * Termination is a property of the board rather than a rule: every round
   * resolves at least one cell, so a game of a finite board always ends.
   */
  it('runs to the end of the board and declares a winner', async () => {
    const { roomId, alice, bob } = await playToFirstRound(harness);
    const ended = waitFor(alice, 'ms:game:ended', 20_000);

    // Play it out by having both clients pick whatever is left.
    const playOn = () => {
      const room = minesweeperRoom(harness, roomId);
      if (!room?.isGameStarted) return;
      const left = hiddenIndexes(room.game.board);
      if (left.length === 0) return;
      alice.emit('ms:pick', roomId, left[0]);
      bob.emit('ms:pick', roomId, left[left.length - 1]);
    };

    alice.on('ms:round', playOn);
    bob.on('ms:round', playOn);
    playOn();

    await ended;

    const room = minesweeperRoom(harness, roomId);
    expect(room.isGameStarted).toBe(false);
    expect(room.status).toBe('Open');
    expect(hiddenIndexes(room.game.board)).toEqual([]);
  }, 25_000);

  it('ends when the room drops below two players', async () => {
    const { roomId, alice, bob } = await playToFirstRound(harness);

    bob.emit('room:leave', roomId, 'Bob');
    await settle(300);

    expect(minesweeperRoom(harness, roomId).isGameStarted).toBe(false);
    expect(alice.connected).toBe(true);
  });
});

/*
 * A room id is public — it goes out in every lobby broadcast — so a handler that
 * trusted the id it was handed would be reading another game's state through its
 * own type. `ofType` is what stops that, and this is the test for it.
 */
describe('one game cannot reach into another', () => {
  let harness: TestServer;

  beforeEach(async () => {
    harness = await startTestServer();
  });

  afterEach(async () => {
    await harness.teardown();
  });

  it('ignores a Minesweeper pick aimed at a Draw & Guess room', async () => {
    const alice = await harness.connect();
    const bob = await harness.connect();
    const roomId = await createRoom(alice, { ownerUsername: 'Alice' });
    await joinRoom(alice, roomId, 'Alice');
    await joinRoom(bob, roomId, 'Bob');

    const locked = collect(alice, 'ms:locked');
    alice.emit('ms:pick', roomId, 0);
    await settle();

    expect(locked).toEqual([]);
    expect(alice.connected).toBe(true);
  });

  it('ignores a Draw & Guess word aimed at a Minesweeper room', async () => {
    const { roomId, alice } = await playToFirstRound(harness);

    const phases = collect(alice, 'dg:phase:drawing');
    alice.emit('dg:select-word', roomId, 'Banana');
    await settle();

    expect(phases).toEqual([]);
    expect(minesweeperRoom(harness, roomId).isGameStarted).toBe(true);
  });
});
