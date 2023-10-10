import { Server, Socket } from 'socket.io';
import { DrawAndGuessDetailRoomInfo, OwnerInfo } from '../../models/types.js';
import {
    getDrawAndGuessLobbyRoomInfo,
    getRoomStatus,
} from '../../libs/utils.js';

const roomEventsHandler = (
    io: Server,
    socket: Socket,
    drawAndGuessDetailRoomInfoList: Record<string, DrawAndGuessDetailRoomInfo>,
    socketInRooms: Record<string, Set<string>>,
) => {
    socket.on(
        'clientJoinDrawAndGuessRoom',
        (roomId: string, username: string, password: string) => {
            try {
                if (!drawAndGuessDetailRoomInfoList[roomId]) {
                    throw new Error('Room does not exist.');
                }

                const currentRoom = drawAndGuessDetailRoomInfoList[roomId];

                if (currentRoom.status !== 'open') {
                    throw new Error('Room is not open.');
                }

                // If room has password, check if password is correct
                if (currentRoom.password && currentRoom.password !== password) {
                    socket.emit('clientEnterPasswordError', {
                        status: true,
                        message: 'Incorrect password. Please try again.',
                    });
                    return;
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
                    currentRoom.isGameStarted,
                );

                socket.join(roomId);
                if (!socketInRooms[socket.id]) {
                    socketInRooms[socket.id] = new Set();
                }
                socketInRooms[socket.id].add(roomId);
                console.log('current room info: ', currentRoom);
                console.log('socket in rooms: ', socketInRooms);

                const drawAndGuessLobbySimplifiedRoomList = Object.values(
                    drawAndGuessDetailRoomInfoList,
                ).map(getDrawAndGuessLobbyRoomInfo);

                socket.emit('clientEnterCorrectPassword', roomId);

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

    socket.on('clientLeaveDrawAndGuessRoom', (roomId: string) => {
        try {
            if (!drawAndGuessDetailRoomInfoList[roomId]) {
                throw new Error('Room does not exist.');
            }

            const currentRoom = drawAndGuessDetailRoomInfoList[roomId];

            delete currentRoom.playerList[socket.id];
            currentRoom.currentPlayerCount = Object.keys(
                currentRoom.playerList,
            ).length; // If app gets slow, use counter instead

            // If the room is empty, delete the room
            if (currentRoom.currentPlayerCount === 0) {
                delete drawAndGuessDetailRoomInfoList[roomId];
            } else {
                // If the leaving client is the owner, transfer ownership to the next client
                if (currentRoom.owner.socketId === socket.id) {
                    const newOwnerSocketId = Object.keys(
                        currentRoom.playerList,
                    )[0];
                    const newOwnerInfo: OwnerInfo = {
                        username:
                            currentRoom.playerList[newOwnerSocketId].username,
                        socketId: newOwnerSocketId,
                    };
                    currentRoom.owner = newOwnerInfo;
                }

                currentRoom.status = getRoomStatus(
                    currentRoom.currentPlayerCount,
                    currentRoom.maxPlayers,
                    currentRoom.isGameStarted,
                );
            }

            socket.leave(roomId);
            socketInRooms[socket.id].delete(roomId);
            console.log('current room info: ', currentRoom);
            console.log('socket in rooms: ', socketInRooms);

            const drawAndGuessLobbySimplifiedRoomList = Object.values(
                drawAndGuessDetailRoomInfoList,
            ).map(getDrawAndGuessLobbyRoomInfo);

            // Notify all clients in the lobby that a client has left a room
            io.emit(
                'updateDrawAndGuessLobbyRoomList',
                drawAndGuessLobbySimplifiedRoomList,
            );

            // Notify all clients in the room that a client has left
            io.to(roomId).emit(
                'clientLeaveDrawAndGuessRoomSuccess',
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
    });
};

export default roomEventsHandler;
