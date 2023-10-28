import { getDrawAndGuessLobbyRoomInfo, generateRoomId, getRoomStatus, } from '../../libs/utils.js';
const lobbyEventsHandler = (io, socket, drawAndGuessDetailRoomInfoList) => {
    socket.on('clientJoinDrawAndGuessLobby', () => {
        console.log('client: ' + socket.id + ' joined draw and guess lobby');
        const drawAndGuessLobbySimplifiedRoomList = Object.values(drawAndGuessDetailRoomInfoList).map(getDrawAndGuessLobbyRoomInfo);
        // Notify the current client that they joined the lobby and send the room list
        socket.emit('updateDrawAndGuessLobbyRoomList', drawAndGuessLobbySimplifiedRoomList);
    });
    socket.on('createDrawAndGuessRoomRequest', (request) => {
        const { roomName, ownerUsername, maxPlayers, rounds, password } = request;
        const roomId = generateRoomId();
        const owner = {
            username: ownerUsername,
            socketId: socket.id,
        };
        // Creating an new empty room
        const newDrawAndGuessRoom = {
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
            currentWordHint: '',
            currentRound: 0,
            isGameStarted: false,
            isWordSelectingPhase: false,
            isDrawingPhase: false,
            isReviewingPhase: false,
            drawerQueue: new Set(),
            wordCategory: '',
            wordChoices: [],
        };
        drawAndGuessDetailRoomInfoList[roomId] = newDrawAndGuessRoom;
        console.log('new room created', newDrawAndGuessRoom);
        const drawAndGuessLobbySimplifiedRoomList = Object.values(drawAndGuessDetailRoomInfoList).map(getDrawAndGuessLobbyRoomInfo);
        // Notify the current client that the room has been created
        socket.emit('createDrawAndGuessRoomSuccess', getDrawAndGuessLobbyRoomInfo(newDrawAndGuessRoom), password);
        // Notify all clients in the lobby that a new room has been created
        io.emit('updateDrawAndGuessLobbyRoomList', drawAndGuessLobbySimplifiedRoomList);
    });
};
export { lobbyEventsHandler };
