import express, { type Request, type Response } from 'express';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import * as url from 'node:url';
import path from 'node:path';
import type {
  Make24DurationsInSeconds,
  MinesweeperDurationsInSeconds,
  PairsDurationsInSeconds,
  PhaseDurationsInSeconds,
  TriosDurationsInSeconds,
} from './libs/game-clock.js';
import { createRoomRegistry } from './libs/rooms/registry.js';
import { createRoomMembership } from './libs/rooms/membership.js';
import { lobbyEventsHandler } from './libs/rooms/lobby-events.js';
import { roomEventsHandler } from './libs/rooms/room-events.js';
import { chatEventsHandler } from './libs/rooms/chat-events.js';
import type { Room } from './libs/rooms/types.js';
import { createDrawAndGuessModule } from './socket/draw-and-guess/index.js';
import { createMinesweeperModule } from './socket/minesweeper/index.js';
import { createMake24Module } from './socket/make-24/index.js';
import { createPairsModule } from './socket/pairs/index.js';
import { createTriosModule } from './socket/trios/index.js';
import { clientDepartureOnDisconnectHandler } from './socket/client-disconnect-handler.js';
import { playerSessionHandler } from './socket/player-session-handler.js';
import {
  createPlayerSessionRegistry,
  type PlayerSessionRegistry,
} from './libs/player-session.js';
import { createRateLimiter } from './libs/rate-limit.js';
import { splitAck, type IoServer } from './libs/rooms/emit.js';
import { invalidRequest } from './models/error.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../shared/wire-types.js';

/** At most one "you are being throttled" line per socket per this long. */
const THROTTLE_LOG_INTERVAL_MS = 5000;

interface CreateZumpoServerOptions {
  /** Defaults to `process.env.CORS_ORIGIN`, then the Vite dev server. */
  corsOrigin?: string;
  /** Serve the built SPA and route unknown paths to it. */
  serveClient?: boolean;
  /** Shortened by the test suite so a full game runs in milliseconds. */
  phaseDurations?: PhaseDurationsInSeconds;
  /** Minesweeper's round window and reveal pause. Shortened by tests. */
  minesweeperDurations?: MinesweeperDurationsInSeconds;
  /** Make 24's hand and its results. Shortened by tests. */
  make24Durations?: Make24DurationsInSeconds;
  /** A Pairs turn and a miss on show. Shortened by tests. */
  pairsDurations?: PairsDurationsInSeconds;
  /** A taken trio's pause, a lockout and the hint clock. Shortened by tests. */
  triosDurations?: TriosDurationsInSeconds;
  /** How long a dropped player keeps their seat. Shortened by tests. */
  graceInSeconds?: number;
}

interface ZumpoServer {
  httpServer: HttpServer;
  io: IoServer;
  /** The live room registry, exposed so tests can assert on server state. */
  rooms: Record<string, Room>;
  /** Exposed so tests can assert on identities outliving their sockets. */
  sessions: PlayerSessionRegistry;
  close: () => Promise<void>;
}

/**
 * Builds a fully wired server without starting it.
 *
 * This used to all happen at module scope in `server.ts`, which meant importing
 * the server was the same thing as binding a port - so the only way to exercise
 * any of it was to spawn a process and talk to a fixed port.
 *
 * The connection block below is now three generic handlers plus a loop over
 * whatever games are registered. It used to be five, every one of them named
 * after Draw & Guess and handed the single `drawAndGuessDetailRoomInfoList`
 * that was the server's entire idea of state.
 */
const createZumpoServer = (
  options: CreateZumpoServerOptions = {},
): ZumpoServer => {
  const {
    corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3001',
    serveClient = process.env.NODE_ENV === 'production',
    phaseDurations,
    minesweeperDurations,
    make24Durations,
    pairsDurations,
    triosDurations,
    graceInSeconds,
  } = options;

  const app = express();
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  // build/server/app.js serves the SPA that Vite builds into build/public.
  const publicStaticFolder = path.join(__dirname, '..', 'public');

  app.use(express.json());
  app.use(cors());
  app.use(express.static(publicStaticFolder));

  const httpServer = createServer(app);
  const io: IoServer = new Server<ClientToServerEvents, ServerToClientEvents>(
    httpServer,
    {
      cors: {
        origin: corsOrigin,
      },
    },
  );

  // All of these are created once for the server rather than per connection:
  // they own timers and identities that outlive any single socket.
  const sessions = createPlayerSessionRegistry();
  const registry = createRoomRegistry(io, sessions);

  // Every game the server knows how to run. A module is registered once and
  // then reached only through the registry - the room layer below never names
  // one, and adding the second took this line and nothing else here.
  registry.register(createDrawAndGuessModule(registry.context, phaseDurations));
  registry.register(
    createMinesweeperModule(registry.context, minesweeperDurations),
  );
  registry.register(createMake24Module(registry.context, make24Durations));
  registry.register(createPairsModule(registry.context, pairsDurations));
  registry.register(createTriosModule(registry.context, triosDurations));

  const membership = createRoomMembership(
    io,
    registry,
    sessions,
    graceInSeconds,
  );

  io.on('connection', (socket) => {
    console.log('a user is connected: ' + socket.id);

    // Before anything else looks at a packet: how often may this socket speak?
    // Every handler below checks the *shape* of what it is sent; this is what
    // bounds how much of it arrives. A dropped packet is never handed on. A
    // request is told so, so that a client waiting on its answer is not left
    // waiting forever; anything else is dropped silently.
    const rateLimiter = createRateLimiter();
    let lastThrottleWarningMs = 0;

    socket.use(([eventName, ...rawArgs], next) => {
      if (rateLimiter.allow(String(eventName))) {
        next();
        return;
      }

      const { ack } = splitAck(rawArgs);
      if (ack) {
        ack(invalidRequest('Too many requests. Try again in a moment.'));
      }

      // Logging every dropped packet would be its own flood.
      const nowMs = Date.now();
      if (nowMs - lastThrottleWarningMs > THROTTLE_LOG_INTERVAL_MS) {
        lastThrottleWarningMs = nowMs;
        console.warn(
          `Throttling ${socket.id}: too many "${String(eventName)}" events.`,
        );
      }
    });

    // Identity first, from the handshake: every handler below reads the player
    // id off the connection, and this runs before any event from it is read.
    playerSessionHandler(
      socket,
      sessions,
      membership.graceMs,
      membership.handleResume,
    );
    clientDepartureOnDisconnectHandler(socket, membership);

    // The room layer: lobbies, seats, ownership, chat. None of it knows which
    // game it is running.
    lobbyEventsHandler(socket, registry, sessions);
    roomEventsHandler(socket, registry, sessions, membership);
    chatEventsHandler(socket, registry, sessions);

    // And then each game's own events.
    for (const gameType of registry.registeredTypes()) {
      registry.moduleFor(gameType)?.registerHandlers(socket);
    }
  });

  if (serveClient) {
    console.log('Serving the built client.');
    // Express 5 / path-to-regexp v8: a bare '*' is no longer a valid path.
    // Wildcards must be named - '/{*splat}' matches the root as well as any subpath.
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile('index.html', { root: publicStaticFolder });
    });
  } else {
    console.log('Running in development mode.');
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.send(
        `Hello, welcome to the Zumpo development server! 🚀\n` +
          `In development mode, the frontend server also needs to be started.\n` +
          `Please ensure it's running and accessible at http://localhost:3001.\n` +
          `Happy coding! 🎉`,
      );
    });
  }

  /**
   * Closes every live connection before the HTTP server, because socket.io
   * keep-alives will otherwise hold the process open long past the test that
   * created them.
   */
  const close = async (): Promise<void> => {
    registry.dispose();
    membership.dispose();
    await io.close();
    await new Promise<void>((resolve) => {
      if (!httpServer.listening) {
        resolve();
        return;
      }
      httpServer.close(() => resolve());
    });
  };

  return { httpServer, io, rooms: registry.all, sessions, close };
};

export { createZumpoServer };
export type { CreateZumpoServerOptions, ZumpoServer };
