import { Socket } from 'socket.io';

interface Coordinate {
    x: number;
    y: number;
}

const whiteboardCanvasEventHandler = (socket: Socket) => {
    socket.on('startDrawing', (roomId: string, coords: Coordinate) => {
        socket.broadcast.to(roomId).emit('drawerStartDrawing', coords);
    });

    socket.on(
        'continueDrawing',
        (roomId: string, coords: Coordinate, color: string, size: number) => {
            socket.broadcast
                .to(roomId)
                .emit('drawerContinueDrawing', coords, color, size);
        },
    );

    socket.on('stopDrawing', (roomId: string) => {
        socket.broadcast.to(roomId).emit('drawerStopDrawing');
    });

    socket.on('undo', (roomId: string, lastStateDataURL) => {
        socket.broadcast.to(roomId).emit('drawerUndo', lastStateDataURL);
    });

    socket.on('clear', (roomId: string) => {
        socket.broadcast.to(roomId).emit('drawerClear');
    });
};

export default whiteboardCanvasEventHandler;
