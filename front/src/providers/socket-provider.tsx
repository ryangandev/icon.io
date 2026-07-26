import { createContext, useEffect, useMemo, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

interface SocketContextProviderProps {
  children: React.ReactNode;
}

interface PlayerIdentity {
  playerId: string;
  token: string;
}

interface SocketContextProps {
  socket: Socket;
  /**
   * Who the server thinks we are. Empty until the handshake completes, which
   * is why the routes that need it wait for a connection before rendering.
   *
   * Room state is keyed by this rather than by `socket.id`, so this is what
   * identifies "me" in a player list, an owner, or a drawer.
   */
  playerId: string;
}

/**
 * Per tab, and surviving a reload — exactly the lifetime a seat at a table
 * should have. `localStorage` would hand two tabs the same identity and they
 * would fight over one seat; nothing at all would mean a refresh makes you a
 * stranger, which is the bug this exists to fix.
 */
const IDENTITY_STORAGE_KEY = 'icon.io:player-identity';

const readStoredIdentity = (): PlayerIdentity | null => {
  try {
    const raw = sessionStorage.getItem(IDENTITY_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PlayerIdentity>;
    if (!parsed.playerId || !parsed.token) return null;

    return { playerId: parsed.playerId, token: parsed.token };
  } catch {
    // Unreadable or malformed storage just means we identify as new.
    return null;
  }
};

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

  const [playerId, setPlayerId] = useState('');

  useEffect(() => {
    // Claim the previous identity if we have one. The server checks the token
    // and silently issues a new identity if it does not hold up, so a stale or
    // tampered-with entry costs nothing but a fresh seat.
    const identify = () => socket.emit('identifyPlayer', readStoredIdentity());

    const handleIdentity = (identity: PlayerIdentity) => {
      sessionStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
      setPlayerId(identity.playerId);
    };

    socket.on('connect', identify);
    socket.on('playerIdentity', handleIdentity);

    // A socket that connected before this effect ran still needs to identify.
    if (socket.connected) identify();

    return () => {
      socket.off('connect', identify);
      socket.off('playerIdentity', handleIdentity);
    };
  }, [socket]);

  useEffect(() => {
    return () => {
      socket.disconnect();
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, playerId }}>
      {children}
    </SocketContext.Provider>
  );
};

export { SocketContext, SocketProvider, IDENTITY_STORAGE_KEY };
