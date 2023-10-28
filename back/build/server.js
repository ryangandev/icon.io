import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import * as url from 'url';
import path from 'path';
import { ChatEventsHandler, GameEventsHandler, lobbyEventsHandler, roomEventsHandler, whiteboardCanvasEventHandler, } from './socket/draw-and-guess/index.js';
import { clientDepartureOnDisconnectHandler } from './socket/client-disconnect-handler.js';
const port = process.env.PORT || 3000;
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3001';
const app = express();
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const publicStaticFolder = path.join(__dirname, 'public');
app.use(express.json());
app.use(cors({
    origin: [corsOrigin, 'https://icon.ryiscrispy.com'],
    credentials: true,
}));
app.use(express.static(publicStaticFolder));
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: [corsOrigin, 'https://icon.ryiscrispy.com'],
        credentials: true,
    },
});
let drawAndGuessDetailRoomInfoList = {};
let socketInRooms = {};
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
    clientDepartureOnDisconnectHandler(io, socket, drawAndGuessDetailRoomInfoList, socketInRooms);
    // handles draw and guess lobby and room events
    lobbyEventsHandler(io, socket, drawAndGuessDetailRoomInfoList);
    roomEventsHandler(io, socket, drawAndGuessDetailRoomInfoList, socketInRooms);
    whiteboardCanvasEventHandler(socket);
    ChatEventsHandler(io, socket, drawAndGuessDetailRoomInfoList);
    GameEventsHandler(io, socket, drawAndGuessDetailRoomInfoList);
});
if (process.env.NODE_ENV === 'production') {
    console.log('Running in production mode.');
    app.get('/*', (req, res) => {
        res.sendFile('index.html', { root: publicStaticFolder });
    });
}
else {
    console.log('Running in development mode.');
    app.get('/*', (req, res) => {
        res.send(`Hello, welcome to the Icon.io development server! 🚀\n` +
            `In development mode, the frontend server also needs to be started.\n` +
            `Please ensure it's running and accessible at http://localhost:3001.\n` +
            `Happy coding! 🎉`);
    });
}
server.listen(port, () => {
    console.log(`✅ Listening on port ${port}`);
});
