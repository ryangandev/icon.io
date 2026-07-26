import type { Server, Socket } from 'socket.io';
import type { DrawAndGuessDetailRoomInfo } from '../../models/types.js';
import type { PlayerSessionRegistry } from '../../libs/player-session.js';
import { chatRequest, parseArgs } from '../../libs/validation.js';

const POINTS_FOR_GUESSER = 100;
const POINTS_FOR_DRAWER = 40;

const ChatEventsHandler = (
  io: Server,
  socket: Socket,
  drawAndGuessDetailRoomInfoList: Record<string, DrawAndGuessDetailRoomInfo>,
  sessions: PlayerSessionRegistry,
) => {
  socket.on('sendMessage', (...rawArgs: unknown[]) => {
    const validated = parseArgs(chatRequest, rawArgs, 'sendMessage');
    if (!validated) return;
    const [roomId, username, message] = validated;

    // Only players in the room may talk in it.
    const playerId = sessions.playerIdFor(socket.id);
    if (!playerId) return;
    if (!drawAndGuessDetailRoomInfoList[roomId]?.playerList[playerId]) {
      return;
    }

    socket.broadcast.to(roomId).emit('receiveMessage', username, message);
  });

  socket.on('takingAGuess', (...rawArgs: unknown[]) => {
    const validated = parseArgs(chatRequest, rawArgs, 'takingAGuess');
    if (!validated) return;
    const [roomId, username, message] = validated;

    const currentRoom = drawAndGuessDetailRoomInfoList[roomId];
    if (!currentRoom) return;

    const playerId = sessions.playerIdFor(socket.id);
    if (!playerId) return;

    const currentPlayer = currentRoom.playerList[playerId];
    const currentDrawer = currentRoom.playerList[currentRoom.currentDrawer];

    /*
     * None of this was checked before. The UI disables the input for the
     * drawer and for anyone who has already scored, and only routes a
     * message here during the drawing phase — but a modified client is not
     * bound by any of that, and could have awarded itself points by
     * guessing its own word, or guessed during the reveal when the word is
     * on screen for everyone to read.
     */
    if (!currentPlayer) return; // not in this room
    if (!currentRoom.isDrawingPhase) return; // nothing to guess yet
    if (currentRoom.currentDrawer === playerId) return; // knows the answer
    if (currentPlayer.receivedPointsThisTurn) return; // already scored
    if (currentRoom.currentWord === '') return;

    const isCorrect =
      message.toLowerCase().trim() ===
      currentRoom.currentWord.toLowerCase().trim();

    if (isCorrect && currentDrawer) {
      currentDrawer.points += POINTS_FOR_DRAWER;
      currentPlayer.points += POINTS_FOR_GUESSER;
      currentPlayer.receivedPointsThisTurn = true;

      io.to(roomId).emit(
        'correctGuessAnnouncement',
        '📢 System',
        username + ' guessed the correct word!',
      );

      io.to(roomId).emit(
        'playersReceivedPointsFromCorrectGuess',
        currentRoom.playerList,
      );
    } else {
      // A wrong guess is just chat. Echoing it back to the sender keeps
      // their own message in their log alongside everyone else's.
      socket.broadcast.to(roomId).emit('receiveMessage', username, message);

      io.to(socket.id).emit('receiveMessage', username + ' (You)', message);
    }
  });
};

export { ChatEventsHandler };
