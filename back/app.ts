import express, { type Request, type Response } from 'express';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import * as url from 'node:url';
import path from 'node:path';
import type { DrawAndGuessDetailRoomInfo } from './models/types.js';
import type { PhaseDurationsInSeconds } from './libs/game-clock.js';
import {
  ChatEventsHandler,
  GameEventsHandler,
  createDrawAndGuessGameEngine,
  lobbyEventsHandler,
  roomEventsHandler,
  whiteboardCanvasEventHandler,
} from './socket/draw-and-guess/index.js';
import { clientDepartureOnDisconnectHandler } from './socket/client-disconnect-handler.js';

interface CreateIconIoServerOptions {
  /** Defaults to `process.env.CORS_ORIGIN`, then the Vite dev server. */
  corsOrigin?: string;
  /** Serve the built SPA and route unknown paths to it. */
  serveClient?: boolean;
  /** Shortened by the test suite so a full game runs in milliseconds. */
  phaseDurations?: PhaseDurationsInSeconds;
}

interface IconIoServer {
  httpServer: HttpServer;
  io: Server;
  /** The live room registry, exposed so tests can assert on server state. */
  rooms: Record<string, DrawAndGuessDetailRoomInfo>;
  close: () => Promise<void>;
}

/**
 * Builds a fully wired server without starting it.
 *
 * This used to all happen at module scope in `server.ts`, which meant importing
 * the server was the same thing as binding a port — so the only way to exercise
 * any of it was to spawn a process and talk to a fixed port. Everything below is
 * unchanged in behaviour; it is just reachable now.
 */
const createIconIoServer = (
  options: CreateIconIoServerOptions = {},
): IconIoServer => {
  const {
    corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3001',
    serveClient = process.env.NODE_ENV === 'production',
    phaseDurations,
  } = options;

  const app = express();
  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const publicStaticFolder = path.join(__dirname, 'public');

  app.use(express.json());
  app.use(cors());
  app.use(express.static(publicStaticFolder));

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
    },
  });

  const rooms: Record<string, DrawAndGuessDetailRoomInfo> = {};
  const socketInRooms: Record<string, Set<string>> = {};

  // Created once for the server, not once per connection: it owns the phase
  // timers for every room, so there can only be one of it.
  const drawAndGuessGameEngine = createDrawAndGuessGameEngine(
    io,
    rooms,
    phaseDurations,
  );

  io.on('connection', (socket) => {
    console.log('a user is connected: ' + socket.id);

    // handles disconnecting client
    clientDepartureOnDisconnectHandler(
      io,
      socket,
      rooms,
      socketInRooms,
      drawAndGuessGameEngine,
    );

    // handles draw and guess lobby and room events
    lobbyEventsHandler(io, socket, rooms);
    roomEventsHandler(io, socket, rooms, socketInRooms, drawAndGuessGameEngine);
    whiteboardCanvasEventHandler(socket);
    ChatEventsHandler(io, socket, rooms);
    GameEventsHandler(socket, drawAndGuessGameEngine);
  });

  if (serveClient) {
    console.log('Serving the built client.');
    // Express 5 / path-to-regexp v8: a bare '*' is no longer a valid path.
    // Wildcards must be named — '/{*splat}' matches the root as well as any subpath.
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile('index.html', { root: publicStaticFolder });
    });
  } else {
    console.log('Running in development mode.');
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.send(
        `Hello, welcome to the Icon.io development server! 🚀\n` +
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
    for (const roomId of Object.keys(rooms)) {
      drawAndGuessGameEngine.disposeRoom(roomId);
    }
    await io.close();
    await new Promise<void>((resolve) => {
      if (!httpServer.listening) {
        resolve();
        return;
      }
      httpServer.close(() => resolve());
    });
  };

  return { httpServer, io, rooms, close };
};

export { createIconIoServer };
export type { CreateIconIoServerOptions, IconIoServer };
