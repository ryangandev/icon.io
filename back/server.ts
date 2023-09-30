import cookieParser from 'cookie-parser';
import express, { Request, Response } from 'express';
import path from 'path';
import * as url from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import {
    handleStartDraw,
    handleDraw,
    handleStopDraw,
    handleUndoDraw,
    handleClearCanvas,
    handleSendMessage,
    updatePlayerList,
} from './socket/index.js';
import { wordBank } from './libs/index.js';

let app = express();
let __dirname = path.dirname(url.fileURLToPath(import.meta.url));
console.log('directory nane', __dirname);
app.use(express.json());
app.use(cookieParser());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
let server = createServer(app);
// For using ecmascript6 import since
// most tutorials do not https://sabe.io/tutorials/how-to-build-real-time-chat-app-node-express-socket-io
let io = new Server(server, {
    cors: {
        origin: 'http://localhost:3001',
    },
});
let port = 3000;

let roomStore = {};
let socketStore: { [key: string]: { roomId: string; username: string } } = {};

function generateRoomId(): string {
    let id = '';
    let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let i = 0; i < 6; i++) {
        id += chars.charAt(Math.floor(Math.random() * 36));
    }
    return id;
}

function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}

// endpoint to create new room!
app.post('/room', function (req: Request, res: Response) {
    let { username } = req.body;
    const roomId = generateRoomId();

    // add entry to new store
    roomStore[roomId] = new Object();
    roomStore[roomId][username] = {};
    roomStore[roomId]['userList'] = [username];
    roomStore[roomId]['gameState'] = false;
    roomStore[roomId]['currentDrawer'] = [username];
    roomStore[roomId]['answer'] = [];
    console.log('roomStore object from /room POST request', roomStore);

    res.json({ roomId: roomId });
});

// Expose the node_modules folder as static resources (to access socket.io.js in the browser)
app.use('/static', express.static('node_modules'));

// for searching for rooms by id
app.get('/rooms', function (req: Request, res: Response) {
    let roomStatus: object[] = [];
    let rooms = Object.keys(roomStore);
    let uniqueRooms = Array.from(new Set(rooms));

    uniqueRooms.forEach((id) => {
        let numPlayers = roomStore[id].userList.length;
        let readyStatus = numPlayers >= 2 && numPlayers <= 8;
        let entry = {
            roomId: id,
            seats: numPlayers,
            status: readyStatus,
        };
        roomStatus.push(entry);
    });

    return res.json(roomStatus);
});

// Handle connection
io.on('connection', function (socket) {
    // console.log('Connected successfully to the socket ...');
    // console.log('Socket ID: ', socket.id);

    socket.on('active_room', (data) => {
        let { username, roomId } = data;

        // check if room even exists and emit that info
        // console.log('room ID: ', roomId);
        let roomError = !Object.keys(roomStore).includes(roomId);
        socket.emit('roomError', roomError);

        // TODO: check if username already exists in room

        if (!roomError) {
            // console.log('roomStore before active_room', roomStore);
            // If a user isn't already in the room store, add them
            if (!Object.keys(roomStore[roomId]).includes(username)) {
                roomStore[roomId][username] = new Object();
                roomStore[roomId]['userList'].push(username);

                if (
                    !roomStore[roomId]['gameState'] &&
                    roomStore[roomId]['userList'].length >= 2
                ) {
                    roomStore[roomId]['gameState'] = true;
                }
                // console.log('roomStore for initial user add', roomStore);
            }
            roomStore[roomId][username][socket.id] = socket.id;

            socketStore[socket.id] = {
                username: username,
                roomId: roomId,
            };
            // console.log('roomStore after active_room', roomStore);
            // console.log('socketStore after active_room', socketStore);
            // console.log('Receiving active_room', username, roomId, socket.id);
            //Generate a random word
            if (roomStore[roomId]['answer'].length === 0) {
                let randomIndex1 = Math.floor(Math.random() * 2);
                let category: string;
                if (randomIndex1 === 1) {
                    category = 'fruitWords';
                } else {
                    category = 'animalWords';
                }
                let randomIndex2 = Math.floor(Math.random() * 10);
                let randomWord = wordBank[category][randomIndex2];
                console.log(randomWord);
                roomStore[roomId]['answer'][0] = randomWord;
            }

            //Conditional rendering based on the drawer
            //User is the current Drawer
            if (roomStore[roomId]['currentDrawer'][0] === username) {
                console.log(socket.id);
                io.to(socket.id).emit(
                    'drawer',
                    true,
                    roomStore[roomId]['answer'][0],
                );
            }
            //User is not the current Drawer
            else {
                io.to(socket.id).emit(
                    'drawer',
                    false,
                    roomStore[roomId]['answer'][0],
                );
            }
            // update user list, io used instead of server to send to all sockets instead of excluding the sender
            updatePlayerList(io, roomId, roomStore);
        }
    });

    socket.on('disconnect', (_) => {
        if (socketStore[socket.id]) {
            console.log('from disconnect', socketStore[socket.id]);

            let { username, roomId } = socketStore[socket.id];

            // Find the socket element that we need to delete in roomStore
            delete roomStore[roomId][username][socket.id];
            // Check if the list in roomStore is now empty
            if (Object.keys(roomStore[roomId][username]).length === 0) {
                delete roomStore[roomId][username];
            }

            // update user list!
            let userLocation = roomStore[roomId]['userList'].indexOf(username);
            if (userLocation !== -1) {
                roomStore[roomId]['userList'].splice(userLocation, 1);
            }

            // update game state
            roomStore[roomId]['gameState'] =
                roomStore[roomId]['userList'].length >= 2 &&
                roomStore[roomId]['userList'].length <= 8;

            // update current drawer
            if (roomStore[roomId]['currentDrawer'] === username) {
                let randomUser = getRandomInt(
                    0,
                    roomStore[roomId]['userList'].length,
                );
                // TODO: Determine what happens when there's no user, what number is generated?
                if (roomStore[roomId]['userList'].length === 0) {
                    roomStore[roomId]['currentDrawer'] = '';
                } else {
                    roomStore[roomId]['currentDrawer'] =
                        roomStore[roomId]['userList'][randomUser];
                }
            }

            // update socket entry in socketStore
            delete socketStore[socket.id];

            // update user list when a user disconnects
            updatePlayerList(io, roomId, roomStore);
        }
    });

    // Handle chat messages
    handleSendMessage(socket, io, roomStore);

    // Handle canvas drawing, socket used instead of io to exclude the sender
    handleStartDraw(socket, roomStore);
    handleDraw(socket, roomStore);
    handleStopDraw(socket, roomStore);
    handleUndoDraw(socket, roomStore);
    handleClearCanvas(socket, roomStore);

    //Handle score updates
    socket.on('updatedScore', (score, userName, room) => {
        console.log(roomStore[room]['userList']);
        roomStore[room]['userList'].forEach((user) => {
            Object.keys(roomStore[room][user]).forEach((key) => {
                io.to(key).emit('receiveScore', score, userName);
            });
        });
    });

    //Handle game start
    socket.on('startGame', (gameStart, room) => {
        roomStore[room]['userList'].forEach((user) => {
            Object.keys(roomStore[room][user]).forEach((key) => {
                io.to(key).emit('start', true);
                io.to(key).emit('startTimer', true);
            });
        });
    });

    //Handle game stop
    socket.on('stopGame', (gameStart, room) => {
        roomStore[room]['userList'].forEach((user) => {
            Object.keys(roomStore[room][user]).forEach((key) => {
                io.to(key).emit('stop', false);
            });
        });
    });
});

// Register the index route of your app that returns the HTML file
// app.get('/', function (req, res) {
//     res.sendFile(__dirname + '/index.html');
// });
app.get('/*', function (req, res) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(port, function () {
    console.log(`Listening on port ${port}`);
});
