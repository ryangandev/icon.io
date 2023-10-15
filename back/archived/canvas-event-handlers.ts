import { Socket } from 'socket.io';

function handleStartDraw(socket: Socket, roomStore: any) {
    socket.on('startDraw', (userName, room, coords) => {
        roomStore[room]['userList'].forEach((user) => {
            Object.keys(roomStore[room][user]).forEach((key) => {
                socket.to(key).emit('receiveStartDraw', coords);
            });
        });
    });
}

function handleDraw(socket: Socket, roomStore: any) {
    socket.on('draw', (userName, room, coords, color, size) => {
        roomStore[room]['userList'].forEach((user) => {
            Object.keys(roomStore[room][user]).forEach((key) => {
                socket.to(key).emit('receiveDraw', coords, color, size);
            });
        });
    });
}

function handleStopDraw(socket: Socket, roomStore: any) {
    socket.on('stopDraw', (userName, room) => {
        roomStore[room]['userList'].forEach((user) => {
            Object.keys(roomStore[room][user]).forEach((key) => {
                socket.to(key).emit('receiveStopDraw');
            });
        });
    });
}

function handleUndoDraw(socket: Socket, roomStore: any) {
    socket.on('undoDraw', (userName, room, lastStateDataURL) => {
        roomStore[room]['userList'].forEach((user) => {
            Object.keys(roomStore[room][user]).forEach((key) => {
                socket.to(key).emit('receiveUndoDraw', lastStateDataURL);
            });
        });
    });
}

function handleClearCanvas(socket: Socket, roomStore: any) {
    socket.on('clearCanvas', (userName, room) => {
        roomStore[room]['userList'].forEach((user) => {
            Object.keys(roomStore[room][user]).forEach((key) => {
                socket.to(key).emit('receiveClearCanvas');
            });
        });
    });
}

export {
    handleStartDraw,
    handleDraw,
    handleStopDraw,
    handleUndoDraw,
    handleClearCanvas,
};
