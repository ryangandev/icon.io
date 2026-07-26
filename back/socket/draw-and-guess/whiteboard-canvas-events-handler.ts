import type { Socket } from 'socket.io';
import {
  continueDrawingRequest,
  parseArgs,
  roomIdOnly,
  startDrawingRequest,
} from '../../libs/validation.js';

const whiteboardCanvasEventHandler = (socket: Socket) => {
  socket.on('startDrawing', (...rawArgs: unknown[]) => {
    const validated = parseArgs(startDrawingRequest, rawArgs, 'startDrawing');
    if (!validated) return;
    const [roomId, coords, color, size] = validated;

    socket.broadcast.to(roomId).emit('drawerStartDrawing', coords, color, size);
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

  // Undo used to carry a full-canvas PNG as a data URL — on the order of
  // 100KB to 1MB, per undo. Every client keeps the same stroke list, so
  // "drop the last stroke" is all that needs to cross the wire.
  socket.on('undo', (...rawArgs: unknown[]) => {
    const validated = parseArgs(roomIdOnly, rawArgs, 'undo');
    if (!validated) return;

    socket.broadcast.to(validated[0]).emit('drawerUndo');
  });

  socket.on('clear', (...rawArgs: unknown[]) => {
    const validated = parseArgs(roomIdOnly, rawArgs, 'clear');
    if (!validated) return;

    socket.broadcast.to(validated[0]).emit('drawerClear');
  });
};

export { whiteboardCanvasEventHandler };
