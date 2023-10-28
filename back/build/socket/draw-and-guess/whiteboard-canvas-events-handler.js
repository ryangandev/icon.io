const whiteboardCanvasEventHandler = (socket) => {
    socket.on('startDrawing', (roomId, coords) => {
        socket.broadcast.to(roomId).emit('drawerStartDrawing', coords);
    });
    socket.on('continueDrawing', (roomId, coords, color, size) => {
        socket.broadcast
            .to(roomId)
            .emit('drawerContinueDrawing', coords, color, size);
    });
    socket.on('stopDrawing', (roomId) => {
        socket.broadcast.to(roomId).emit('drawerStopDrawing');
    });
    socket.on('undo', (roomId, lastStateDataURL) => {
        socket.broadcast.to(roomId).emit('drawerUndo', lastStateDataURL);
    });
    socket.on('clear', (roomId) => {
        socket.broadcast.to(roomId).emit('drawerClear');
    });
};
export { whiteboardCanvasEventHandler };
