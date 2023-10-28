function updatePlayerList(io, roomId, roomStore) {
    const updatedUserList = roomStore[roomId]['userList'];
    updatedUserList.forEach((user) => {
        Object.keys(roomStore[roomId][user]).forEach((key) => {
            io.to(key).emit('updatePlayers', updatedUserList);
        });
    });
}
function getRoomsStatus(roomStore) {
    return Object.keys(roomStore).map((roomId) => {
        return {
            roomId: roomId,
            seats: roomStore[roomId]['userList'].length,
            status: roomStore[roomId]['gameState'],
        };
    });
}
export { updatePlayerList, getRoomsStatus };
