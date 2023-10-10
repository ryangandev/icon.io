import { Server, Socket } from 'socket.io';
import { DrawAndGuessDetailRoomInfo } from '../../models/types.js';
import {
    getDrawAndGuessLobbyRoomInfo,
    getRoomStatus,
} from '../../libs/utils.js';

const roomEventsHandler = (
    io: Server,
    socket: Socket,
    drawAndGuessDetailRoomInfoList: Record<string, DrawAndGuessDetailRoomInfo>,
) => {
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
};

export default roomEventsHandler;
