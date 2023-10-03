import { createContext, useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextProviderProps {
    children: React.ReactNode;
}

interface SocketContextProps {
    socket: Socket;
}

const SocketContext = createContext<SocketContextProps | null>(null);

const SocketProvider: React.FC<SocketContextProviderProps> = ({ children }) => {
    const socket = useMemo(
        () =>
            io(process.env.ICONIO_SERVER_URL || 'http://localhost:30000', {
                autoConnect: false,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
            }),
        [],
    );

    useEffect(() => {
        return () => {
            socket.disconnect();
        };
    }, [socket]);

    return (
        <SocketContext.Provider value={{ socket }}>
            {children}
        </SocketContext.Provider>
    );
};

export { SocketContext, SocketProvider };
