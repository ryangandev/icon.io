import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createSocket, REQUEST_TIMEOUT_MS, type ZumpoSocket } from './socket';
import { readIdentity, readName, writeIdentity, writeName } from './storage';

/**
 * Where the connection stands.
 *
 * - idle: nothing has needed the server yet.
 * - connecting: the first connection is being made.
 * - online: connected and identified; requests can be sent.
 * - reconnecting: the connection dropped and the client is retrying, while
 *   the server holds this player's seats.
 * - failed: retries ran out; only "Try again" starts over.
 */
export type ConnectionStatus =
  'idle' | 'connecting' | 'online' | 'reconnecting' | 'failed';

export interface Session {
  socket: ZumpoSocket;
  status: ConnectionStatus;
  /** Who the server says we are; '' until the first identification. */
  playerId: string;
  /** How long the server keeps a dropped player's seat. */
  reconnectGraceMs: number;
  /**
   * Counts identifications. Anything kept on the server for this connection,
   * like a lobby subscription or a room's listeners, is set up again when it
   * changes.
   */
  connectionId: number;
  /** The player's name for this browser session; '' until they choose one. */
  name: string;
  setName: (name: string) => void;
  /** Starts connecting, or starts over after a failure; idempotent otherwise. */
  connect: () => void;
}

const SessionContext = createContext<Session | null>(null);

export interface SessionProviderProps {
  children: ReactNode;
  /** Tests pass a stand-in; the app creates the real one. */
  socket?: ZumpoSocket;
}

export function SessionProvider({
  children,
  socket: given,
}: SessionProviderProps) {
  const [socket] = useState(() => given ?? createSocket());
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [playerId, setPlayerId] = useState('');
  const [reconnectGraceMs, setReconnectGraceMs] = useState(0);
  const [connectionId, setConnectionId] = useState(0);
  const [name, setNameState] = useState(readName);

  useEffect(() => {
    let everOnline = false;

    const identify = async () => {
      try {
        const session = await socket
          .timeout(REQUEST_TIMEOUT_MS)
          .emitWithAck('session:identify', readIdentity());
        writeIdentity(session);
        everOnline = true;
        setPlayerId(session.playerId);
        setReconnectGraceMs(session.reconnectGraceMs);
        setConnectionId((id) => id + 1);
        setStatus('online');
      } catch {
        // No answer: the connection is unusable, so let the reconnection
        // logic start over rather than sit connected and unidentified.
        socket.disconnect().connect();
      }
    };

    const onDisconnect = (reason: string) => {
      if (reason === 'io client disconnect') return;
      setStatus(everOnline ? 'reconnecting' : 'connecting');
      // The server closed the connection itself, which socket.io does not
      // retry on its own.
      if (!socket.active) socket.connect();
    };

    const onConnectError = () => {
      // Rejected outright rather than unreachable: retrying will not help.
      if (!socket.active) setStatus('failed');
    };

    const onReconnectFailed = () => setStatus('failed');

    socket.on('connect', identify);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.io.on('reconnect_failed', onReconnectFailed);

    return () => {
      socket.off('connect', identify);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.io.off('reconnect_failed', onReconnectFailed);
    };
  }, [socket]);

  useEffect(() => () => void socket.disconnect(), [socket]);

  // Read by `connect`, which must stay stable for the effects that call it.
  const statusRef = useRef(status);
  statusRef.current = status;

  const connect = useCallback(() => {
    const current = statusRef.current;
    if (current !== 'idle' && current !== 'failed') return;
    statusRef.current = 'connecting';
    setStatus('connecting');
    // After a failure the manager has given up; start it from scratch.
    if (current === 'failed') socket.disconnect();
    socket.connect();
  }, [socket]);

  const setName = useCallback((next: string) => {
    writeName(next);
    setNameState(next);
  }, []);

  const value = useMemo<Session>(
    () => ({
      socket,
      status,
      playerId,
      reconnectGraceMs,
      connectionId,
      name,
      setName,
      connect,
    }),
    [
      socket,
      status,
      playerId,
      reconnectGraceMs,
      connectionId,
      name,
      setName,
      connect,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession needs a SessionProvider above it');
  return session;
}

/**
 * The session, connected: a page that talks to the server calls this, and the
 * first such page opens the connection.
 */
export function useConnectedSession(): Session {
  const session = useSession();
  const { connect } = session;
  useEffect(() => connect(), [connect]);
  return session;
}
