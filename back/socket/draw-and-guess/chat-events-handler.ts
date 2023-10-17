import { Server, Socket } from 'socket.io';

const ChatEventsHandler = (io: Server, socket: Socket) => {
    socket.on(
        'sendMessage',
        (roomId: string, username: string, message: string) => {
            socket.broadcast
                .to(roomId)
                .emit('receiveMessage', username, message);
        },
    );
};

export default ChatEventsHandler;
