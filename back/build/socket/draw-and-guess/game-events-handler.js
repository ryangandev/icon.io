import { getDrawAndGuessLobbyRoomInfo, getRandomCategory, getRandomChoicesFromList, getRoomStatus, getRandomElementFromSet, convertStrToUnderscores, resetReceivedPointsThisTurn, resetPoints, } from '../../libs/utils.js';
import { wordBank } from '../../libs/word-bank.js';
const GameEventsHandler = (io, socket, drawAndGuessDetailRoomInfoList) => {
    socket.on('startDrawAndGuessGame', (roomId) => {
        try {
            if (!drawAndGuessDetailRoomInfoList[roomId]) {
                const err = new Error('Room does not exist.');
                err.errorType = 'roomNotExist';
                throw err;
            }
            const currentRoom = drawAndGuessDetailRoomInfoList[roomId];
            if (currentRoom.currentPlayerCount < 2) {
                const err = new Error('At least 2 players are required to start.');
                err.errorType = 'notEnoughPlayers';
                throw err;
            }
            // Reset all players' points
            currentRoom.playerList = resetPoints(currentRoom.playerList);
            // Select a random category from the word bank
            const randomCategory = getRandomCategory(wordBank);
            const randomCategoryName = Object.keys(randomCategory)[0];
            currentRoom.isGameStarted = true;
            currentRoom.status = getRoomStatus(currentRoom.currentPlayerCount, currentRoom.maxPlayers, currentRoom.isGameStarted);
            currentRoom.wordCategory = randomCategoryName;
            console.log('startDrawAndGuessGame', currentRoom);
            // Update the clients about room info
            io.to(roomId).emit('startDrawAndGuessGameSuccess', {
                playerList: currentRoom.playerList,
                isGameStarted: currentRoom.isGameStarted,
                status: currentRoom.status,
                wordCategory: currentRoom.wordCategory,
            });
            // Announce all clients in the room that game has started
            io.to(roomId).emit('receiveMessage', '📢 System', 'Game has started! The word category for this game is "' +
                currentRoom.wordCategory +
                '"!');
            const drawAndGuessLobbySimplifiedRoomList = Object.values(drawAndGuessDetailRoomInfoList).map(getDrawAndGuessLobbyRoomInfo);
            // Update room info in the lobby
            io.emit('updateDrawAndGuessLobbyRoomList', drawAndGuessLobbySimplifiedRoomList);
            startNewRound(currentRoom);
        }
        catch (error) {
            console.log(error);
            socket.emit('roomError', {
                status: true,
                message: error.message,
                errorType: error.errorType,
            });
        }
    });
    socket.on('drawerSelectWordFinished', (roomId, word) => {
        try {
            const currentRoom = drawAndGuessDetailRoomInfoList[roomId];
            currentRoom.currentWord = word;
            currentRoom.currentWordHint = convertStrToUnderscores(word);
            currentRoom.isWordSelectingPhase = false;
            currentRoom.isDrawingPhase = true;
            currentRoom.wordChoices = []; // Empty the word choices after the drawer has selected a word
            // Notify all clients in the room that the drawer has selected a word and drawing phase has started
            io.to(roomId).emit('drawingPhaseStarted', {
                currentWordHint: currentRoom.currentWordHint,
                isWordSelectingPhase: currentRoom.isWordSelectingPhase,
                isDrawingPhase: currentRoom.isDrawingPhase,
                wordChoices: currentRoom.wordChoices,
            });
            // Notify the drawer ONLY that drawing phase has started and send the word to be drawn
            io.to(currentRoom.currentDrawer).emit('drawingPhaseStartedForDrawer', word);
        }
        catch (error) {
            console.log(error);
        }
    });
    socket.on('drawingPhaseTimerEnded', (roomId) => {
        try {
            const currentRoom = drawAndGuessDetailRoomInfoList[roomId];
            currentRoom.isDrawingPhase = false;
            currentRoom.isReviewingPhase = true;
            // Notify all clients in the room that drawing phase has ended and reviewing phase has started
            io.to(roomId).emit('reviewingPhaseStarted', {
                isDrawingPhase: currentRoom.isDrawingPhase,
                isReviewingPhase: currentRoom.isReviewingPhase,
                currentWord: currentRoom.currentWord,
            });
        }
        catch (error) {
            console.log(error);
        }
    });
    socket.on('reviewingPhaseTimerEnded', (roomId) => {
        try {
            const currentRoom = drawAndGuessDetailRoomInfoList[roomId];
            // Reset the room info
            currentRoom.isReviewingPhase = false;
            currentRoom.currentDrawer = '';
            currentRoom.currentWord = '';
            currentRoom.currentWordHint = '';
            // Notify all clients in the room that reviewing phase has ended
            io.to(roomId).emit('reviewingPhaseEnded', {
                isReviewingPhase: currentRoom.isReviewingPhase,
                currentDrawer: currentRoom.currentDrawer,
                currentWord: currentRoom.currentWord,
                currentWordHint: currentRoom.currentWordHint,
            });
            if (currentRoom.drawerQueue.size > 0) {
                startNewDrawerTurn(currentRoom);
            }
            else if (currentRoom.currentRound < currentRoom.rounds) {
                startNewRound(currentRoom);
            }
            else {
                currentRoom.currentRound = 0;
                currentRoom.isGameStarted = false;
                currentRoom.status = getRoomStatus(currentRoom.currentPlayerCount, currentRoom.maxPlayers, currentRoom.isGameStarted);
                currentRoom.wordCategory = '';
                // Update the clients about room info
                io.to(roomId).emit('endDrawAndGuessGame', currentRoom);
                // Announce all clients in the room that game has ended
                io.to(roomId).emit('receiveMessage', '📢 System', 'Game has ended!');
                const drawAndGuessLobbySimplifiedRoomList = Object.values(drawAndGuessDetailRoomInfoList).map(getDrawAndGuessLobbyRoomInfo);
                io.emit('updateDrawAndGuessLobbyRoomList', drawAndGuessLobbySimplifiedRoomList);
            }
        }
        catch (error) {
            console.log(error);
        }
    });
    // Helper functions
    const startNewRound = (currentRoom) => {
        currentRoom.currentRound += 1; // Increment round number
        currentRoom.drawerQueue = new Set(Object.keys(currentRoom.playerList)); // Reset drawer queue
        io.to(currentRoom.roomId).emit('startNewRoundSuccess', {
            currentRound: currentRoom.currentRound,
            drawerQueue: [...currentRoom.drawerQueue],
        });
        startNewDrawerTurn(currentRoom);
    };
    const startNewDrawerTurn = (currentRoom) => {
        // Clear the canvas for the new drawer
        io.to(currentRoom.roomId).emit('drawerClear');
        // Reset all players' receivedPointsThisTurn to false
        currentRoom.playerList = resetReceivedPointsThisTurn(currentRoom.playerList);
        // Select a new drawer from the drawer queue
        const newDrawer = getRandomElementFromSet(currentRoom.drawerQueue);
        const randomChoicesFromCategory = getRandomChoicesFromList(wordBank[currentRoom.wordCategory], 3);
        currentRoom.currentDrawer = newDrawer;
        currentRoom.drawerQueue.delete(newDrawer);
        currentRoom.isWordSelectingPhase = true;
        currentRoom.wordChoices = randomChoicesFromCategory;
        // Notify all clients in the room that a new drawer has been selected and word selecting phase has started
        io.to(currentRoom.roomId).emit('wordSelectingPhaseStarted', {
            playerList: currentRoom.playerList,
            currentDrawer: currentRoom.currentDrawer,
            drawerQueue: [...currentRoom.drawerQueue],
            isWordSelectingPhase: currentRoom.isWordSelectingPhase,
        });
        // Notify the new drawer ONLY and send the word choices for them to choose
        io.to(newDrawer).emit('drawerReceiveWordChoices', currentRoom.wordChoices);
    };
};
export { GameEventsHandler };
