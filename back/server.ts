import express, { type Request, type Response } from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import * as url from 'node:url';
import path from 'node:path';
import type { DrawAndGuessDetailRoomInfo } from './models/types.js';
import {
    ChatEventsHandler,
    GameEventsHandler,
    createDrawAndGuessGameEngine,
    lobbyEventsHandler,
    roomEventsHandler,
    whiteboardCanvasEventHandler,
} from './socket/draw-and-guess/index.js';
import { clientDepartureOnDisconnectHandler } from './socket/client-disconnect-handler.js';

const port = process.env.PORT || 3000;
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3001';

const app = express();
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const publicStaticFolder = path.join(__dirname, 'public');

app.use(express.json());
app.use(cors());
app.use(express.static(publicStaticFolder));

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: corsOrigin,
    },
});

let drawAndGuessDetailRoomInfoList: Record<string, DrawAndGuessDetailRoomInfo> =
    {};
let socketInRooms: Record<string, Set<string>> = {};

// Created once for the process, not once per connection: it owns the phase
// timers for every room, so there can only be one of it.
const drawAndGuessGameEngine = createDrawAndGuessGameEngine(
    io,
    drawAndGuessDetailRoomInfoList,
);

io.on('connection', (socket) => {
    console.log('a user is connected: ' + socket.id);

    // Helpful socket.io debugging methods
    // check how many sockets in a room with a partiular roomid
    // const room = io.sockets.adapter.rooms.get(roomId);
    // console.log('socket room info: ', room);

    // check rooms that a socket is in given a socket id
    // const rooms = Array.from(socket.rooms);
    // console.log('socket rooms info: ', rooms);

    // handles disconnecting client
    clientDepartureOnDisconnectHandler(
        io,
        socket,
        drawAndGuessDetailRoomInfoList,
        socketInRooms,
        drawAndGuessGameEngine,
    );

    // handles draw and guess lobby and room events
    lobbyEventsHandler(io, socket, drawAndGuessDetailRoomInfoList);
    roomEventsHandler(
        io,
        socket,
        drawAndGuessDetailRoomInfoList,
        socketInRooms,
        drawAndGuessGameEngine,
    );
    whiteboardCanvasEventHandler(socket);
    ChatEventsHandler(io, socket, drawAndGuessDetailRoomInfoList);
    GameEventsHandler(socket, drawAndGuessGameEngine);
});

if (process.env.NODE_ENV === 'production') {
    console.log('Running in production mode.');
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

server.listen(port, () => {
    console.log(`✅ Listening on port ${port}`);
});
