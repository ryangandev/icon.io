import { getDrawAndGuessLobbyRoomInfo, getRoomStatus, } from '../../libs/utils.js';
const roomEventsHandler = (io, socket, drawAndGuessDetailRoomInfoList, socketInRooms) => {
    socket.on('clientJoinDrawAndGuessRoomRequest', (roomId, username, password) => {
        try {
            if (!drawAndGuessDetailRoomInfoList[roomId]) {
                const err = new Error('Room does not exist.');
                err.errorType = 'roomNotExist';
                throw err;
            }
            const currentRoom = drawAndGuessDetailRoomInfoList[roomId];
            if (currentRoom.status !== 'Open') {
                const err = new Error('Room is not open.');
                err.errorType = 'roomNotOpen';
                throw err;
            }
            // If room has password, check if password is correct, if not, send reject event
            if (currentRoom.password && currentRoom.password !== password) {
                socket.emit('rejectClientJoinDrawAndGuessRoomRequest', {
                    status: true,
                    message: 'Incorrect password. Please try again.',
                });
                return;
            }
            currentRoom.playerList[socket.id] = {
                username: username,
                points: 0,
                receivedPointsThisTurn: false,
            };
            currentRoom.currentPlayerCount = Object.keys(currentRoom.playerList).length; // If app gets slow, use counter instead
            currentRoom.status = getRoomStatus(currentRoom.currentPlayerCount, currentRoom.maxPlayers, currentRoom.isGameStarted);
            socket.join(roomId);
            if (!socketInRooms[socket.id]) {
                socketInRooms[socket.id] = new Set();
            }
            socketInRooms[socket.id].add(roomId);
            console.log('current room info: ', currentRoom);
            console.log('socket in rooms: ', socketInRooms);
            const drawAndGuessLobbySimplifiedRoomList = Object.values(drawAndGuessDetailRoomInfoList).map(getDrawAndGuessLobbyRoomInfo);
            // Notify the current client that they will be joining the room
            socket.emit('approveClientJoinDrawAndGuessRoomRequest', roomId);
            // Notify all clients in the lobby that a client has joined a room
            io.emit('updateDrawAndGuessLobbyRoomList', drawAndGuessLobbySimplifiedRoomList);
            setTimeout(() => {
                // Notify all clients in the room that a new client has joined
                io.to(roomId).emit('clientJoinDrawAndGuessRoomSuccess', currentRoom);
                io.to(roomId).emit('receiveMessage', '📢 System', username + ' has joined the room.');
            }, 250); // Delay to ensure that the client has joined the room
        }
        catch (error) {
            console.error(error);
            // Notify the current client that there was an error
            socket.emit('roomError', {
                status: true,
                message: error.message,
                errorType: error.errorType,
            });
        }
    });
    socket.on('clientLeaveDrawAndGuessRoom', (roomId, username) => {
        // TODO: add a boolean parameter for an edge case when the client leaves the room when the game is in progress
        try {
            if (!drawAndGuessDetailRoomInfoList[roomId]) {
                const err = new Error('Room does not exist.');
                err.errorType = 'roomNotExist';
                throw err;
            }
            const currentRoom = drawAndGuessDetailRoomInfoList[roomId];
            const isLeavingClientOwner = currentRoom.owner.socketId === socket.id;
            delete currentRoom.playerList[socket.id];
            currentRoom.currentPlayerCount = Object.keys(currentRoom.playerList).length; // If app gets slow, use counter instead
            // If the room is empty, delete the room
            if (currentRoom.currentPlayerCount === 0) {
                delete drawAndGuessDetailRoomInfoList[roomId];
            }
            else {
                // If the leaving client is the owner, transfer ownership to the next client
                if (isLeavingClientOwner) {
                    const newOwnerSocketId = Object.keys(currentRoom.playerList)[0];
                    const newOwnerInfo = {
                        username: currentRoom.playerList[newOwnerSocketId]
                            .username,
                        socketId: newOwnerSocketId,
                    };
                    currentRoom.owner = newOwnerInfo;
                    // Notify all clients in the room that the ownership has been transferred here
                    io.to(roomId).emit('receiveMessage', '📢 System', 'Previous owner ' +
                        username +
                        ' has left the room. ' +
                        newOwnerInfo.username +
                        ' is now the owner.');
                }
                currentRoom.status = getRoomStatus(currentRoom.currentPlayerCount, currentRoom.maxPlayers, currentRoom.isGameStarted);
            }
            socket.leave(roomId);
            socketInRooms[socket.id].delete(roomId);
            console.log('current room info: ', currentRoom);
            console.log('socket in rooms: ', socketInRooms);
            const drawAndGuessLobbySimplifiedRoomList = Object.values(drawAndGuessDetailRoomInfoList).map(getDrawAndGuessLobbyRoomInfo);
            // Notify all clients in the room that a client has left
            io.to(roomId).emit('clientLeaveDrawAndGuessRoomSuccess', currentRoom);
            // Only notify if the leaving client is not the owner, because the ownership transfer was notified above
            if (!isLeavingClientOwner) {
                io.to(roomId).emit('receiveMessage', '📢 System', username + ' has left the room.');
            }
            // Notify all clients in the lobby that a client has left a room
            io.emit('updateDrawAndGuessLobbyRoomList', drawAndGuessLobbySimplifiedRoomList);
        }
        catch (error) {
            console.error(error);
            // Notify the current client that there was an error
            socket.emit('roomError', {
                status: true,
                message: error.message,
            });
        }
    });
};
export { roomEventsHandler };
