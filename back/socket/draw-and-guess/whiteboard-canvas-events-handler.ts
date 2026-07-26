import type { Socket } from 'socket.io';
import type { DrawAndGuessDetailRoomInfo } from '../../models/types.js';
import type { PlayerSessionRegistry } from '../../libs/player-session.js';
import {
  continueDrawingRequest,
  parseArgs,
  roomIdOnly,
  startDrawingRequest,
} from '../../libs/validation.js';

/**
 * The canvas relay.
 *
 * This was the one handler that never received the membership check the guess
 * path got: it validated the *shape* of a payload and then broadcast it to
 * whatever room id it was handed. Room ids are not secret — the lobby list is
 * `io.emit`-ed to every connected client and carries `roomId` for every room,
 * locked ones included — so a client that had never joined a room could draw on
 * it, undo the drawer's last stroke, or wipe the canvas mid-turn. `clear` was
 * the worst of them: one emit, and a stranger's drawing was gone.
 *
 * The rule enforced here is the one the UI has always shown: the canvas belongs
 * to whoever is drawing on it, and only while they are drawing.
 */
const whiteboardCanvasEventHandler = (
  socket: Socket,
  rooms: Record<string, DrawAndGuessDetailRoomInfo>,
  sessions: PlayerSessionRegistry,
) => {
  const holdsThePencil = (roomId: string): boolean => {
    // Identity comes from the connection, never from the payload.
    const playerId = sessions.playerIdFor(socket.id);
    if (!playerId) return false;

    const room = rooms[roomId];
    if (!room) return false;
    if (!room.playerList[playerId]) return false; // not in this room
    if (room.currentDrawer !== playerId) return false; // not their turn
    return room.isDrawingPhase; // and not before or after it
  };

  socket.on('startDrawing', (...rawArgs: unknown[]) => {
    const validated = parseArgs(startDrawingRequest, rawArgs, 'startDrawing');
    if (!validated) return;
    const [roomId, coords, color, size] = validated;
    if (!holdsThePencil(roomId)) return;

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
    if (!holdsThePencil(roomId)) return;

    socket.broadcast
      .to(roomId)
      .emit('drawerContinueDrawing', coords, color, size);
  });

  socket.on('stopDrawing', (...rawArgs: unknown[]) => {
    const validated = parseArgs(roomIdOnly, rawArgs, 'stopDrawing');
    if (!validated) return;
    const [roomId] = validated;
    if (!holdsThePencil(roomId)) return;

    socket.broadcast.to(roomId).emit('drawerStopDrawing');
  });

  // Undo used to carry a full-canvas PNG as a data URL — on the order of
  // 100KB to 1MB, per undo. Every client keeps the same stroke list, so
  // "drop the last stroke" is all that needs to cross the wire.
  socket.on('undo', (...rawArgs: unknown[]) => {
    const validated = parseArgs(roomIdOnly, rawArgs, 'undo');
    if (!validated) return;
    const [roomId] = validated;
    if (!holdsThePencil(roomId)) return;

    socket.broadcast.to(roomId).emit('drawerUndo');
  });

  socket.on('clear', (...rawArgs: unknown[]) => {
    const validated = parseArgs(roomIdOnly, rawArgs, 'clear');
    if (!validated) return;
    const [roomId] = validated;
    if (!holdsThePencil(roomId)) return;

    socket.broadcast.to(roomId).emit('drawerClear');
  });
};

export { whiteboardCanvasEventHandler };
