const ChatEventsHandler = (io, socket, drawAndGuessDetailRoomInfoList) => {
    socket.on('sendMessage', (roomId, username, message) => {
        socket.broadcast
            .to(roomId)
            .emit('receiveMessage', username, message);
    });
    socket.on('takingAGuess', (roomId, username, message) => {
        const currenRoom = drawAndGuessDetailRoomInfoList[roomId];
        const currentPlayer = currenRoom.playerList[socket.id];
        const currentDrawer = currenRoom.playerList[currenRoom.currentDrawer];
        if (message.toLowerCase() ===
            currenRoom.currentWord.toLowerCase() &&
            currentPlayer.receivedPointsThisTurn === false) {
            currentDrawer.points += 40;
            currentPlayer.points += 100;
            currentPlayer.receivedPointsThisTurn = true;
            io.to(roomId).emit('correctGuessAnnouncement', '📢 System', username + ' guessed the correct word!');
            io.to(roomId).emit('playersReceivedPointsFromCorrectGuess', currenRoom.playerList);
        }
        else {
            // If the guess is wrong
            socket.broadcast
                .to(roomId)
                .emit('receiveMessage', username, message);
            io.to(socket.id).emit('receiveMessage', username + ' (You)', message);
        }
    });
};
export { ChatEventsHandler };
