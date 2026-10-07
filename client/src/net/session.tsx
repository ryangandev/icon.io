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
import { useLocale, type Locale } from '../i18n';
import { createSocket, type ZumpoSocket } from './socket';
import { randomName } from '../players/random-name';
import { readName, writeIdentity, writeName, type StoredName } from './storage';

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
  /**
   * The player's name: picked at random on the first visit, so there always
   * is one, and remembered by this browser.
   */
  name: string;
  /** Still the name picked for them, rather than one they chose. */
  namePicked: boolean;
  /**
   * The name they chose: remembered, and given to every seat they hold, which
   * the server shows their room at once.
   */
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
  // The first visit's name is picked in the visitor's language.
  const { locale } = useLocale();
  const [stored, setStored] = useState(() => firstName(locale));

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

  const setName = useCallback(
    (next: string) => {
      const chosen = { name: next.trim(), picked: false };
      writeName(chosen);
      setStored(chosen);
      // Offline, socket.io holds this until the connection is back, and a
      // player who has not connected yet has no seat to rename: the server
      // answers and changes nothing. Either way there is nothing to report.
      socket.emit('player:rename', chosen.name, () => {});
    },
    [socket],
  );

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
      name: stored.name,
      namePicked: stored.picked,
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
      stored,
      setName,
      connect,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

/** The remembered name, or a new random one remembered from now on. */
function firstName(locale: Locale): StoredName {
  const remembered = readName();
  if (remembered) return remembered;
  const picked = { name: randomName(locale), picked: true };
  writeName(picked);
  return picked;
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
