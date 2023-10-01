import { useContext } from 'react';
import { SocketContext } from '../providers/socket-provider';

const useSocket = () => {
    const socket = useContext(SocketContext);

    if (!socket) {
        throw new Error(
            'App must be used within a SocketProvider to use useSocket hook',
        );
    }

    return socket;
};

export { useSocket };
