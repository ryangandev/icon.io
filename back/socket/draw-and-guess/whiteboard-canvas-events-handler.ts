import type { Socket } from 'socket.io';
import type { DrawAndGuessDetailRoomInfo } from '../../models/types.js';
import type { PlayerSessionRegistry } from '../../libs/player-session.js';
import {
  continueDrawingRequest,
  parseArgs,
  roomIdOnly,
  startDrawingRequest,
} from '../../libs/validation.js';
import {
  beginStroke,
  clearCanvas,
  extendStroke,
  undoStroke,
} from './canvas.js';

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
  /**
   * The room this socket may currently draw in, or null. Returns the room
   * itself because every event below goes on to record itself in that room's
   * canvas — the stored drawing and the relayed one are built from the same
   * events, in the same place, so they cannot drift apart.
   */
  const pencilRoomOf = (roomId: string): DrawAndGuessDetailRoomInfo | null => {
    // Identity comes from the connection, never from the payload.
    const playerId = sessions.playerIdFor(socket.id);
    if (!playerId) return null;

    const room = rooms[roomId];
    if (!room) return null;
    if (!room.playerList[playerId]) return null; // not in this room
    if (room.currentDrawer !== playerId) return null; // not their turn
    if (!room.isDrawingPhase) return null; // and not before or after it

    return room;
  };

  socket.on('startDrawing', (...rawArgs: unknown[]) => {
    const validated = parseArgs(startDrawingRequest, rawArgs, 'startDrawing');
    if (!validated) return;
    const [roomId, coords, color, size] = validated;

    const room = pencilRoomOf(roomId);
    if (!room) return;
    if (!beginStroke(room.canvas, color, size, coords)) return;

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

    const room = pencilRoomOf(roomId);
    if (!room) return;
    if (!extendStroke(room.canvas, coords)) return;

    socket.broadcast
      .to(roomId)
      .emit('drawerContinueDrawing', coords, color, size);
  });

  socket.on('stopDrawing', (...rawArgs: unknown[]) => {
    const validated = parseArgs(roomIdOnly, rawArgs, 'stopDrawing');
    if (!validated) return;
    const [roomId] = validated;

    // Nothing to record: a stroke is complete as soon as its last point
    // arrives. The event exists so a client can close its path.
    if (!pencilRoomOf(roomId)) return;

    socket.broadcast.to(roomId).emit('drawerStopDrawing');
  });

  // Undo used to carry a full-canvas PNG as a data URL — on the order of
  // 100KB to 1MB, per undo. Every client keeps the same stroke list, so
  // "drop the last stroke" is all that needs to cross the wire.
  socket.on('undo', (...rawArgs: unknown[]) => {
    const validated = parseArgs(roomIdOnly, rawArgs, 'undo');
    if (!validated) return;
    const [roomId] = validated;

    const room = pencilRoomOf(roomId);
    if (!room) return;
    undoStroke(room.canvas);

    socket.broadcast.to(roomId).emit('drawerUndo');
  });

  socket.on('clear', (...rawArgs: unknown[]) => {
    const validated = parseArgs(roomIdOnly, rawArgs, 'clear');
    if (!validated) return;
    const [roomId] = validated;

    const room = pencilRoomOf(roomId);
    if (!room) return;
    clearCanvas(room.canvas);

    socket.broadcast.to(roomId).emit('drawerClear');
  });
};

export { whiteboardCanvasEventHandler };
