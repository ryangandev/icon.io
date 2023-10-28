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
    // https://socket.io/how-to/use-with-react#example
    const URL =
        process.env.NODE_ENV === 'production'
            ? undefined
            : 'http://localhost:3000';

    // Initialize socket
    const socket = useMemo(
        () =>
            // @ts-ignore: "undefined" means the URL will be computed from the `window.location` object
            io(URL, {
                autoConnect: false,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
            }),
        [URL],
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
