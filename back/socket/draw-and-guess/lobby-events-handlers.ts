import { Server, Socket } from 'socket.io';
import {
    DrawAndGuessDetailRoomInfo,
    PlayerInfo,
    RoomCreateRequestBody,
} from '../../models/types.js';
import {
    getDrawAndGuessLobbyRoomInfo,
    generateRoomId,
    getRoomStatus,
} from '../../libs/utils.js';

const lobbyEventsHandler = (
    io: Server,
    socket: Socket,
    drawAndGuessDetailRoomInfoList: Record<string, DrawAndGuessDetailRoomInfo>,
) => {
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
};

export default lobbyEventsHandler;