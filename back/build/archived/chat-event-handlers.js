function handleSendMessage(socket, io, roomStore) {
    socket.on('sendMessage', (message, userName, room, alreadyReceievedPts) => {
        if (roomStore[room]['answer'][0] === message) {
            if (alreadyReceievedPts) {
                io.to(socket.id).emit('receiveMessage', 'You have already guessed it correctly!');
            }
            else {
                io.to(socket.id).emit('correctAnswer', userName, room);
                io.to(socket.id).emit('ptsReceived', true);
                roomStore[room]['userList'].forEach((user) => {
                    Object.keys(roomStore[room][user]).forEach((key) => {
                        socket
                            .to(key)
                            .emit('receiveMessage', userName + ' has guessed correctly!');
                    });
                });
            }
        }
        else {
            roomStore[room]['userList'].forEach((user) => {
                Object.keys(roomStore[room][user]).forEach((key) => {
                    socket
                        .to(key)
                        .emit('receiveMessage', userName + ': ' + message);
                });
            });
        }
    });
}
export { handleSendMessage };
