import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import * as url from 'url';
import path from 'path';
import { DrawAndGuessDetailRoomInfo } from './models/types.js';
import lobbyEventsHandler from './socket/draw-and-guess/lobby-events-handler.js';
import roomEventsHandler from './socket/draw-and-guess/room-events-handler.js';
import clientDepartureOnDisconnectHandler from './socket/client-disconnect-handler.js';
import whiteboardCanvasEventHandler from './socket/draw-and-guess/whiteboard-canvas-events-handler.js';
import ChatEventsHandler from './socket/draw-and-guess/chat-events-handler.js';
import GameEventsHandler from './socket/draw-and-guess/game-events-handler.js';

const app = express();
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
console.log('directory nane', __dirname);

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3001',
    },
});

let drawAndGuessDetailRoomInfoList: Record<string, DrawAndGuessDetailRoomInfo> =
    {};
let socketInRooms: Record<string, Set<string>> = {};

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
    );

    // handles draw and guess lobby and room events
    lobbyEventsHandler(io, socket, drawAndGuessDetailRoomInfoList);
    roomEventsHandler(
        io,
        socket,
        drawAndGuessDetailRoomInfoList,
        socketInRooms,
    );
    whiteboardCanvasEventHandler(socket);
    ChatEventsHandler(io, socket, drawAndGuessDetailRoomInfoList);
    GameEventsHandler(io, socket, drawAndGuessDetailRoomInfoList);
});

app.get('/', (req: Request, res: Response) => {
    res.send('Hello, welcome to Icon.io server!');
});

app.get('/*', function (req: Request, res: Response) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = 3000;
server.listen(port, () => {
    console.log(`✅ Listening on port ${port}`);
});
