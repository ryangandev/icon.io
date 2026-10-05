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
import type { SessionInfo } from '../../../shared/wire-types';
import { createSocket, type ZumpoSocket } from './socket';
import { readName, writeIdentity, writeName } from './storage';

/**
 * Where the connection stands.
 *
 * - idle: nothing has needed the server yet.
 * - connecting: the first connection is being made.
 * - online: connected and identified; requests can be sent.
 * - reconnecting: the connection dropped and the client is retrying, while
 *   the server holds this player's seats.
 * - failed: retries ran out; only "Try again" starts over.
 * - replaced: another tab with this player's identity took over; only the
 *   player choosing this tab again starts over.
 */
export type ConnectionStatus =
  'idle' | 'connecting' | 'online' | 'reconnecting' | 'failed' | 'replaced';

export interface Session {
  socket: ZumpoSocket;
  status: ConnectionStatus;
  /** Gone until the player acts: `failed` or `replaced`. */
  lost: boolean;
  /** Who the server says we are; '' until the first identification. */
  playerId: string;
  /** How long the server keeps a dropped player's seat. */
  reconnectGraceMs: number;
  /**
   * The live connection, numbered from 1 as the server identifies each one;
   * null while not online. Anything the server keeps per connection, like a
   * lobby subscription or a room's listeners, is set up again for each.
   */
  connection: number | null;
  /** The player's name for this browser session; '' until they choose one. */
  name: string;
  setName: (name: string) => void;
  /**
   * Starts connecting, or starts over after a failure or a takeover;
   * idempotent otherwise.
   */
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
  const [status, setStatusState] = useState<ConnectionStatus>('idle');
  // Mirrors `status` for `connect`, which must stay stable for the effects
  // that call it; every change goes through `setStatus` to keep the two equal.
  const statusRef = useRef<ConnectionStatus>('idle');
  const setStatus = useCallback((next: ConnectionStatus) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);
  const [playerId, setPlayerId] = useState('');
  const [reconnectGraceMs, setReconnectGraceMs] = useState(0);
  const [identified, setIdentified] = useState(0);
  const [name, setNameState] = useState(readName);

  useEffect(() => {
    let everOnline = false;
    let replaced = false;

    // The server settles who this connection is from the handshake, and says
    // so before anything else.
    const onReady = (session: SessionInfo) => {
      writeIdentity(session);
      everOnline = true;
      replaced = false;
      setPlayerId(session.playerId);
      setReconnectGraceMs(session.reconnectGraceMs);
      setIdentified((count) => count + 1);
      setStatus('online');
    };

    // A duplicated tab took this identity over. Reconnecting would take it
    // back, and the two tabs would trade it forever, so this one waits.
    const onReplaced = () => {
      replaced = true;
    };

    const onDisconnect = (reason: string) => {
      if (reason === 'io client disconnect') return;
      if (replaced) {
        setStatus('replaced');
        return;
      }
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

    socket.on('session:ready', onReady);
    socket.on('session:replaced', onReplaced);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.io.on('reconnect_failed', onReconnectFailed);

    return () => {
      socket.off('session:ready', onReady);
      socket.off('session:replaced', onReplaced);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.io.off('reconnect_failed', onReconnectFailed);
    };
  }, [socket, setStatus]);

  // Unmounted, the session lets the connection go and starts from idle, so a
  // remount (React's development double mount, for one) connects again.
  useEffect(
    () => () => {
      socket.disconnect();
      setStatus('idle');
    },
    [socket, setStatus],
  );

  const connect = useCallback(() => {
    const current = statusRef.current;
    if (current !== 'idle' && current !== 'failed' && current !== 'replaced') {
      return;
    }
    setStatus('connecting');
    // After a failure the manager has given up; start it from scratch.
    if (current !== 'idle') socket.disconnect();
    socket.connect();
  }, [socket, setStatus]);

  const setName = useCallback((next: string) => {
    writeName(next);
    setNameState(next);
  }, []);

  const connection = status === 'online' ? identified : null;
  const lost = status === 'failed' || status === 'replaced';
  const value = useMemo<Session>(
    () => ({
      socket,
      status,
      lost,
      playerId,
      reconnectGraceMs,
      connection,
      name,
      setName,
      connect,
    }),
    [
      socket,
      status,
      lost,
      playerId,
      reconnectGraceMs,
      connection,
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
