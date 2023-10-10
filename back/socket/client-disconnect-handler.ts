import { Server, Socket } from 'socket.io';
import { DrawAndGuessDetailRoomInfo } from '../models/types.js';
import { getDrawAndGuessLobbyRoomInfo, getRoomStatus } from '../libs/utils.js';

const clientDepartureOnDisconnectHandler = (
    io: Server,
    socket: Socket,
    drawAndGuessDetailRoomInfoList: Record<string, DrawAndGuessDetailRoomInfo>,
    socketInRooms: Record<string, Set<string>>,
) => {
    socket.on('disconnect', () => {
        console.log('client: ' + socket.id + ' disconnected');
        // Go through all rooms that the disconnecting socket is in and remove the it from them
        const roomsSocketIsIn = socketInRooms[socket.id] || new Set();
        console.log(
            'rooms socket is in before disconnection: ',
            roomsSocketIsIn,
        );
        roomsSocketIsIn.forEach((roomId) => {
            const currentRoom = drawAndGuessDetailRoomInfoList[roomId];
            if (currentRoom.playerList[socket.id]) {
                delete currentRoom.playerList[socket.id];
                currentRoom.currentPlayerCount = Object.keys(
                    currentRoom.playerList,
                ).length; // If app gets slow, use counter instead
                currentRoom.status = getRoomStatus(
                    currentRoom.currentPlayerCount,
                    currentRoom.maxPlayers,
                    currentRoom.isGameStarted,
                );

                console.log('current room info: ', currentRoom);

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
            }
        });

        // Remove the socket from the socketInRooms object when clean up is done
        delete socketInRooms[socket.id];
    });
};

export default clientDepartureOnDisconnectHandler;
