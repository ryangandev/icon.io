import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import * as url from 'url';
import path from 'path';
import {
    DrawAndGuessDetailRoomInfo,
    PlayerInfo,
    RoomCreateRequestBody,
} from './models/types.js';
import {
    generateRoomId,
    getDrawAndGuessLobbyRoomInfo,
    getRoomStatus,
} from './libs/utils.js';

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

io.on('connection', (socket) => {
    console.log('a user is connected: ' + socket.id);

    // Helpful socket.io debugging methods
    // check how many sockets in a room with a partiular roomid
    // const room = io.sockets.adapter.rooms.get(roomId);
    // console.log('socket room info: ', room);

    // check rooms that a socket is in given a socket id
    // const rooms = Array.from(socket.rooms);
    // console.log('socket rooms info: ', rooms);

    socket.on('disconnect', () => {
        console.log('client: ' + socket.id + ' disconnected');
    });

    socket.on('clientJoinDrawAndGuessLobby', () => {
        console.log('client: ' + socket.id + ' joined draw and guess lobby');
        const drawAndGuessLobbySimplifiedRoomList = Object.values(
            drawAndGuessDetailRoomInfoList,
        ).map(getDrawAndGuessLobbyRoomInfo);

        // Notify the current client that they joined the lobby and send the room list
        socket.emit(
            'updateDrawAndGuessLobbyRoomList',
            drawAndGuessLobbySimplifiedRoomList,
        );
    });

    socket.on('createDrawAndGuessRoom', (request: RoomCreateRequestBody) => {
        const { roomName, ownerUsername, maxPlayers, rounds, password } =
            request;
        const roomId = generateRoomId();
        const owner: PlayerInfo = {
            username: ownerUsername,
            score: 0,
        };

        // Creating an new empty room
        const newDrawAndGuessRoom: DrawAndGuessDetailRoomInfo = {
            roomId,
            roomName,
            owner,
            status: getRoomStatus(0, maxPlayers),
            currentPlayerCount: 0,
            maxPlayers,
            rounds,
            password,
            playerList: {},
            currentDrawer: '',
            currentWord: '',
            currentRound: 1,
            isGameStarted: false,
            isGameEnded: false,
        };

        drawAndGuessDetailRoomInfoList[roomId] = newDrawAndGuessRoom;

        console.log('new room created', newDrawAndGuessRoom);

        const drawAndGuessLobbySimplifiedRoomList = Object.values(
            drawAndGuessDetailRoomInfoList,
        ).map(getDrawAndGuessLobbyRoomInfo);

        // Notify all clients in the lobby that a new room has been created
        io.emit(
            'updateDrawAndGuessLobbyRoomList',
            drawAndGuessLobbySimplifiedRoomList,
        );

        // Notify the current client that the room has been created
        socket.emit(
            'createDrawAndGuessRoomSuccess',
            getDrawAndGuessLobbyRoomInfo(newDrawAndGuessRoom),
        );
    });

    socket.on(
        'clientJoinDrawAndGuessRoom',
        (roomId: string, username: string) => {
            try {
                if (!drawAndGuessDetailRoomInfoList[roomId]) {
                    throw new Error('Room does not exist.');
                }

                const currentRoom = drawAndGuessDetailRoomInfoList[roomId];

                if (currentRoom.status !== 'open') {
                    throw new Error('Room is not open.');
                }

                if (currentRoom.password !== '') {
                    throw new Error('Password is required.');
                }

                currentRoom.playerList[socket.id] = {
                    username: username,
                    score: 0,
                };
                currentRoom.currentPlayerCount = Object.keys(
                    currentRoom.playerList,
                ).length; // If app gets slow, use counter instead
                currentRoom.status = getRoomStatus(
                    currentRoom.currentPlayerCount,
                    currentRoom.maxPlayers,
                );

                socket.join(roomId);
                console.log('current room info: ', currentRoom);

                const drawAndGuessLobbySimplifiedRoomList = Object.values(
                    drawAndGuessDetailRoomInfoList,
                ).map(getDrawAndGuessLobbyRoomInfo);

                // Notify all clients in the lobby that a client has joined a room
                io.emit(
                    'updateDrawAndGuessLobbyRoomList',
                    drawAndGuessLobbySimplifiedRoomList,
                );

                // Notify all clients in the room that a new client has joined
                io.to(roomId).emit(
                    'newClientJoinDrawAndGuessRoomSuccess',
                    currentRoom,
                );
            } catch (error: any) {
                console.error(error);
                // Notify the current client that there was an error
                socket.emit('roomError', {
                    status: true,
                    message: error.message,
                });
            }
        },
    );
});

app.get('/', (req: Request, res: Response) => {
    res.send('Hello, welcome to Icon.io server!');
});

app.get('/*', function (req: Request, res: Response) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = 3000;
server.listen(port, () => {
    console.log(`✔️ Listening on port ${port}`);
});
