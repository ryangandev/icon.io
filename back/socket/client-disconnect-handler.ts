import { Server, Socket } from 'socket.io';
import { DrawAndGuessDetailRoomInfo, OwnerInfo } from '../models/types.js';
import { getDrawAndGuessLobbyRoomInfo, getRoomStatus } from '../libs/utils.js';

const clientDepartureOnDisconnectHandler = (
    io: Server,
    socket: Socket,
    drawAndGuessDetailRoomInfoList: Record<string, DrawAndGuessDetailRoomInfo>,
    socketInRooms: Record<string, Set<string>>,
) => {
    socket.on('disconnect', () => {
        try {
            console.log('client: ' + socket.id + ' disconnected');
            // Go through all rooms that the disconnecting socket is in and remove the it from them
            const roomsSocketIsIn = socketInRooms[socket.id] || new Set();

            roomsSocketIsIn.forEach((roomId) => {
                const currentRoom = drawAndGuessDetailRoomInfoList[roomId];
                if (currentRoom.playerList[socket.id]) {
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
                                    currentRoom.playerList[newOwnerSocketId]
                                        .username,
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
        } catch (error: any) {
            console.error('Error handling disconnection:', error.message);
        }
    });
};

export { clientDepartureOnDisconnectHandler };
