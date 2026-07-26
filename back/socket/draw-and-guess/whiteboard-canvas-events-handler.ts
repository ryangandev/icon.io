import type { Socket } from 'socket.io';
import {
    continueDrawingRequest,
    parseArgs,
    roomIdOnly,
    startDrawingRequest,
    undoRequest,
} from '../../libs/validation.js';

const whiteboardCanvasEventHandler = (socket: Socket) => {
    socket.on('startDrawing', (...rawArgs: unknown[]) => {
        const validated = parseArgs(startDrawingRequest, rawArgs, 'startDrawing');
        if (!validated) return;
        const [roomId, coords] = validated;

        socket.broadcast.to(roomId).emit('drawerStartDrawing', coords);
    });

    socket.on('continueDrawing', (...rawArgs: unknown[]) => {
        const validated = parseArgs(
            continueDrawingRequest,
            rawArgs,
            'continueDrawing',
        );
        if (!validated) return;
        const [roomId, coords, color, size] = validated;

        socket.broadcast
            .to(roomId)
            .emit('drawerContinueDrawing', coords, color, size);
    });

    socket.on('stopDrawing', (...rawArgs: unknown[]) => {
        const validated = parseArgs(roomIdOnly, rawArgs, 'stopDrawing');
        if (!validated) return;

        socket.broadcast.to(validated[0]).emit('drawerStopDrawing');
    });

    socket.on('undo', (...rawArgs: unknown[]) => {
        const validated = parseArgs(undoRequest, rawArgs, 'undo');
        if (!validated) return;
        const [roomId, lastStateDataURL] = validated;

        socket.broadcast.to(roomId).emit('drawerUndo', lastStateDataURL);
    });

    socket.on('clear', (...rawArgs: unknown[]) => {
        const validated = parseArgs(roomIdOnly, rawArgs, 'clear');
        if (!validated) return;

        socket.broadcast.to(validated[0]).emit('drawerClear');
    });
};

export { whiteboardCanvasEventHandler };
