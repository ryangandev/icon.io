import type { AddressInfo } from 'node:net';
import { io as createClient, type Socket } from 'socket.io-client';
import { createIconIoServer, type IconIoServer } from '../../app.js';
import type {
  MinesweeperDurationsInSeconds,
  PhaseDurationsInSeconds,
} from '../../libs/game-clock.js';
import type { MinesweeperState } from '../../socket/minesweeper/index.js';
import type {
  DrawAndGuessLobbyRoomInfo,
  DrawAndGuessRoomState,
  DrawAndGuessState,
  GameType,
  LobbyRoomInfo,
  PlayerInfo,
} from '../../models/types.js';
import type { Room } from '../../libs/rooms/types.js';

/**
 * Phases short enough that a full game runs inside a test, but long enough that
 * a loaded machine does not tick past one before the assertions for it run.
 */
const FAST_PHASES: PhaseDurationsInSeconds = {
  wordSelecting: 0.3,
  drawing: 0.4,
  reviewing: 0.2,
};

/**
 * A round window long enough that a test can pick inside it deliberately, and a
 * reveal short enough that a game of many rounds still finishes in a test.
 */
const FAST_MINESWEEPER: MinesweeperDurationsInSeconds = {
  round: 0.6,
  reveal: 0.1,
};

interface PlayerIdentity {
  playerId: string;
  token: string;
}

/**
 * What `dg:scores` carries after a correct guess. It used to be the player list
 * on its own; who has already scored is now the game's own state rather than a
 * flag on every `PlayerInfo`, so it travels alongside.
 */
interface ScoresPayload {
  playerList: Record<string, PlayerInfo>;
  scoredThisTurn: string[];
}

/**
 * A connected client that has already identified itself. `playerId` is what the
 * server keys rooms by, so it is what assertions about seats and scores use —
 * `socket.id` no longer appears in room state at all.
 */
interface TestClient extends Socket {
  playerId: string;
  token: string;
}

interface TestServer {
  url: string;
  server: IconIoServer;
  /** Opens a client, connects it, and completes the identity handshake. */
  connect: (identity?: PlayerIdentity) => Promise<TestClient>;
  /**
   * What a browser refresh does: drop the connection and open a new one
   * presenting the same identity. The returned client is a different socket
   * claiming to be the same player.
   */
  reload: (client: TestClient) => Promise<TestClient>;
  /** Closes every client this harness opened, then the server. */
  teardown: () => Promise<void>;
}

/**
 * Boots a real server on an ephemeral port. Every suite gets its own, so a room
 * left behind by one test can never be seen by another — the throwaway scripts
 * this suite replaces all shared one long-lived server on a fixed port, and
 * leaked state between them was a recurring source of false failures.
 */
const startTestServer = async (
  phaseDurations: PhaseDurationsInSeconds = FAST_PHASES,
  graceInSeconds = 0.6,
  minesweeperDurations: MinesweeperDurationsInSeconds = FAST_MINESWEEPER,
): Promise<TestServer> => {
  const server = createIconIoServer({
    serveClient: false,
    phaseDurations,
    minesweeperDurations,
    graceInSeconds,
  });

  await new Promise<void>((resolve) => {
    server.httpServer.listen(0, '127.0.0.1', () => resolve());
  });

  const { port } = server.httpServer.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;
  const clients: Socket[] = [];

  const connect = (identity?: PlayerIdentity): Promise<TestClient> =>
    new Promise((resolve, reject) => {
      const client = createClient(url, {
        transports: ['websocket'],
        forceNew: true,
      }) as TestClient;
      clients.push(client);
      client.on('connect_error', reject);

      client.on('connect', () => {
        // Every real client identifies before doing anything else; the server
        // reads the player id off the connection, never off a payload.
        client.once('playerIdentity', (issued: PlayerIdentity) => {
          client.playerId = issued.playerId;
          client.token = issued.token;
          resolve(client);
        });
        client.emit('identifyPlayer', identity ?? null);
      });
    });

  const reload = async (client: TestClient): Promise<TestClient> => {
    const identity = { playerId: client.playerId, token: client.token };
    client.close();
    return connect(identity);
  };

  const teardown = async (): Promise<void> => {
    for (const client of clients) client.close();
    await server.close();
  };

  return { url, server, connect, reload, teardown };
};

/**
 * Resolves with the next `event`, rejecting if it never arrives.
 *
 * A single-argument emit resolves with that argument; a multi-argument one —
 * `receiveMessage` sends a username and a message — resolves with the arguments
 * as an array, so nothing the server sends is silently dropped.
 */
const waitFor = <T = unknown>(
  socket: Socket,
  event: string,
  timeoutMs = 3000,
): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for "${event}"`));
    }, timeoutMs);

    const onEvent = (...args: unknown[]) => {
      clearTimeout(timer);
      socket.off(event, onEvent);
      resolve((args.length === 1 ? args[0] : args) as T);
    };

    socket.on(event, onEvent);
  });

/**
 * Resolves with the first `event` whose payload satisfies `predicate`.
 *
 * `room:state` is one event now where it used to be three — a join, a leave and
 * a re-sync all carry the same snapshot, which is the point of the room layer
 * but does mean "the next snapshot" is no longer the same thing as "the
 * snapshot caused by what I just did". A test that cares which one it got says
 * so here rather than racing the one before it.
 */
const waitUntil = <T = unknown>(
  socket: Socket,
  event: string,
  predicate: (payload: T) => boolean,
  timeoutMs = 3000,
): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for a matching "${event}"`));
    }, timeoutMs);

    const onEvent = (...args: unknown[]) => {
      const payload = (args.length === 1 ? args[0] : args) as T;
      if (!predicate(payload)) return;

      clearTimeout(timer);
      socket.off(event, onEvent);
      resolve(payload);
    };

    socket.on(event, onEvent);
  });

/**
 * Records every payload of `event` for later assertion. Used where a test needs
 * to prove something did *not* happen, which no amount of waiting can show.
 */
const collect = <T = unknown[]>(socket: Socket, event: string): T[] => {
  const received: T[] = [];
  socket.on(event, (...args: unknown[]) => {
    received.push((args.length === 1 ? args[0] : args) as T);
  });
  return received;
};

/** Long enough for an emit to have made a full round trip if it was going to. */
const settle = (ms = 150): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

interface CreateRoomOptions {
  roomName?: string;
  ownerUsername?: string;
  maxPlayers?: number;
  rounds?: number;
  password?: string;
}

/**
 * Creates a Draw & Guess room and returns its id, without joining it.
 *
 * The request is the room layer's envelope with the game's own half in
 * `settings` — `rounds` used to be a top-level field, back when there was only
 * one game for it to belong to.
 */
const createRoom = async (
  socket: Socket,
  options: CreateRoomOptions = {},
): Promise<string> => {
  const created = waitFor<string>(socket, 'room:created');
  socket.emit('room:create', {
    gameType: 'draw-and-guess',
    roomName: options.roomName ?? 'Test Room',
    ownerUsername: options.ownerUsername ?? 'Owner',
    maxPlayers: options.maxPlayers ?? 4,
    password: options.password ?? '',
    settings: { rounds: options.rounds ?? 1 },
  });
  return created;
};

/** Joins a room and resolves once the server has approved the request. */
const joinRoom = async (
  socket: Socket,
  roomId: string,
  username: string,
  password = '',
): Promise<void> => {
  const approved = waitFor(socket, 'room:joined');
  socket.emit('room:join', roomId, username, password);
  await approved;
};

/**
 * Seats two players and plays as far as the drawing phase, reporting who the
 * server picked to draw, who is left guessing, and what the word is.
 *
 * The drawer is chosen at random, so no test may assume it is a particular
 * client — and since the canvas and the guess path are both only open to the
 * drawer, most tests of either need this first.
 */
const playToDrawingPhase = async (harness: TestServer) => {
  const alice = await harness.connect();
  const bob = await harness.connect();

  const roomId = await createRoom(alice, { ownerUsername: 'Alice', rounds: 1 });
  await joinRoom(alice, roomId, 'Alice');
  await joinRoom(bob, roomId, 'Bob');

  let drawer: TestClient | undefined;
  let word: string | undefined;
  const learn = (socket: TestClient) => (received: string) => {
    drawer = socket;
    word = received;
  };
  alice.once('dg:word', learn(alice));
  bob.once('dg:word', learn(bob));

  const drawing = waitFor(alice, 'dg:phase:drawing', 5000);
  alice.emit('game:start', roomId);
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

/**
 * The lobby's view of a single room, as any subscriber would see it.
 *
 * Subscribing is what asks for the list now: a lobby is a socket.io room per
 * game rather than an `io.emit` to everyone, so a client that has not asked
 * for Draw & Guess's rooms is never sent them.
 */
const lobbyView = async (
  socket: Socket,
  roomId: string,
  gameType: GameType = 'draw-and-guess',
): Promise<LobbyRoomInfo | undefined> => {
  const list = waitUntil<[string, LobbyRoomInfo[]]>(
    socket,
    'lobby:rooms',
    ([forGame]) => forGame === gameType,
  );
  socket.emit('lobby:subscribe', gameType);
  const [, rooms] = await list;
  return rooms.find((room) => room.roomId === roomId);
};

/** The server's own copy of a room, typed as the Draw & Guess room it is. */
const serverRoom = (
  harness: TestServer,
  roomId: string,
): Room<DrawAndGuessState> =>
  harness.server.rooms[roomId] as Room<DrawAndGuessState>;

/**
 * The same, for Minesweeper. Tests reach through to the hidden layout on
 * purpose: knowing where the mines are is the only way to assert on what a pick
 * *should* have paid, and it is exactly what a client can never see.
 */
const minesweeperRoom = (
  harness: TestServer,
  roomId: string,
): Room<MinesweeperState> =>
  harness.server.rooms[roomId] as Room<MinesweeperState>;

interface CreateMinesweeperRoomOptions {
  roomName?: string;
  ownerUsername?: string;
  maxPlayers?: number;
  difficulty?: 'Small' | 'Medium' | 'Large';
  password?: string;
}

/** Creates a Minesweeper room and returns its id, without joining it. */
const createMinesweeperRoom = async (
  socket: Socket,
  options: CreateMinesweeperRoomOptions = {},
): Promise<string> => {
  const created = waitFor<string>(socket, 'room:created');
  socket.emit('room:create', {
    gameType: 'minesweeper',
    roomName: options.roomName ?? 'Minefield',
    ownerUsername: options.ownerUsername ?? 'Owner',
    maxPlayers: options.maxPlayers ?? 4,
    password: options.password ?? '',
    settings: { difficulty: options.difficulty ?? 'Small' },
  });
  return created;
};

/** Seats two players in a Minesweeper room and starts the first round. */
const playToFirstRound = async (harness: TestServer) => {
  const alice = await harness.connect();
  const bob = await harness.connect();

  const roomId = await createMinesweeperRoom(alice, {
    ownerUsername: 'Alice',
  });
  await joinRoom(alice, roomId, 'Alice');
  await joinRoom(bob, roomId, 'Bob');

  const round = waitFor<{ round: number; board: number[] }>(
    alice,
    'ms:round',
    5000,
  );
  alice.emit('game:start', roomId);
  const first = await round;

  return { roomId, alice, bob, first };
};

export {
  FAST_PHASES,
  FAST_MINESWEEPER,
  startTestServer,
  waitFor,
  waitUntil,
  collect,
  settle,
  createRoom,
  joinRoom,
  playToDrawingPhase,
  lobbyView,
  serverRoom,
  createMinesweeperRoom,
  minesweeperRoom,
  playToFirstRound,
};
export type {
  TestServer,
  TestClient,
  PlayerIdentity,
  ScoresPayload,
  DrawAndGuessRoomState,
  DrawAndGuessLobbyRoomInfo,
};
