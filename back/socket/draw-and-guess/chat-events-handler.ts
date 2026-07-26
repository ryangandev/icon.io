import type { Server, Socket } from 'socket.io';
import type { DrawAndGuessDetailRoomInfo } from '../../models/types.js';
import { chatRequest, parseArgs } from '../../libs/validation.js';

const ChatEventsHandler = (
    io: Server,
    socket: Socket,
    drawAndGuessDetailRoomInfoList: Record<string, DrawAndGuessDetailRoomInfo>,
) => {
    socket.on('sendMessage', (...rawArgs: unknown[]) => {
        const validated = parseArgs(chatRequest, rawArgs, 'sendMessage');
        if (!validated) return;
        const [roomId, username, message] = validated;

        socket.broadcast.to(roomId).emit('receiveMessage', username, message);
    });

    socket.on('takingAGuess', (...rawArgs: unknown[]) => {
        const validated = parseArgs(chatRequest, rawArgs, 'takingAGuess');
        if (!validated) return;
        const [roomId, username, message] = validated;

        const currentRoom = drawAndGuessDetailRoomInfoList[roomId];
        const currentPlayer = currentRoom.playerList[socket.id];
        const currentDrawer = currentRoom.playerList[currentRoom.currentDrawer];

        if (
            message.toLowerCase() === currentRoom.currentWord.toLowerCase() &&
            currentPlayer.receivedPointsThisTurn === false
        ) {
            currentDrawer.points += 40;
            currentPlayer.points += 100;
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
            // If the guess is wrong
            socket.broadcast
                .to(roomId)
                .emit('receiveMessage', username, message);

            io.to(socket.id).emit(
                'receiveMessage',
                username + ' (You)',
                message,
            );
        }
    });
};

export { ChatEventsHandler };
