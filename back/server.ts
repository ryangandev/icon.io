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

    socket.on('disconnect', () => {
        console.log('client: ' + socket.id + ' disconnected');
    });

    socket.on('clientJoinDrawAndGuessLobby', () => {
        console.log('client: ' + socket.id + ' joined draw and guess lobby');
        const drawAndGuessLobbySimplifiedRoomList = Object.values(
            drawAndGuessDetailRoomInfoList,
        ).map(getDrawAndGuessLobbyRoomInfo);

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

        const newDrawAndGuessRoom: DrawAndGuessDetailRoomInfo = {
            roomId,
            roomName,
            owner,
            status: getRoomStatus(1, maxPlayers),
            currentPlayerCount: 1,
            maxPlayers,
            rounds,
            password,
            playerList: {
                [socket.id]: owner,
            },
            currentDrawer: socket.id,
            currentWord: '',
            currentRound: 1,
            isGameStarted: false,
            isGameEnded: false,
        };

        drawAndGuessDetailRoomInfoList[roomId] = newDrawAndGuessRoom;

        const drawAndGuessLobbySimplifiedRoomList = Object.values(
            drawAndGuessDetailRoomInfoList,
        ).map(getDrawAndGuessLobbyRoomInfo);

        io.emit(
            'updateDrawAndGuessLobbyRoomList',
            drawAndGuessLobbySimplifiedRoomList,
        );
    });
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
