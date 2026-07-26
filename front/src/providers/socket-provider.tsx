import { createContext, useEffect, useMemo } from 'react';
import { io, type Socket } from 'socket.io-client';

interface SocketContextProviderProps {
  children: React.ReactNode;
}

interface SocketContextProps {
  socket: Socket;
}

const SocketContext = createContext<SocketContextProps | null>(null);

const SocketProvider: React.FC<SocketContextProviderProps> = ({ children }) => {
  // https://socket.io/how-to/use-with-react#example
  // In production the Express server serves this bundle, so an undefined URL
  // lets socket.io derive the origin from `window.location`.
  const URL = import.meta.env.PROD
    ? undefined
    : (import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3000');

  // Initialize socket
  const socket = useMemo(
    () =>
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
