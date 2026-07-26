import { useEffect, useRef, useState } from 'react';
import { Spin, Typography } from 'antd';
import toast from 'react-hot-toast';
import { Navigate, Outlet } from 'react-router';
import { useSocket } from '../hooks/useSocket';
import '../styles/components/require-socket.css';

type ConnectionStatus = 'connecting' | 'connected' | 'failed';

/**
 * How long to wait for a first connection before giving up. socket.io retries
 * five times with a growing delay, and sitting on a spinner for all of that
 * tells the visitor nothing.
 */
const CONNECT_TIMEOUT_MS = 10_000;

/**
 * Gates the routes that need a live socket.
 *
 * This used to redirect to `/Gamehub` whenever `socket.connected` was false at
 * first render — which it always is on a fresh page load, because the socket is
 * opened by the Gamehub page and a deep link never goes through it. Pasting a
 * room URL, or refreshing while in a room, therefore always bounced you out.
 *
 * Opening the connection here is what makes those URLs work. The redirect is
 * kept for the case it was meant for: the server genuinely cannot be reached.
 */
const RequireSocket = () => {
  const { socket } = useSocket();
  const [status, setStatus] = useState<ConnectionStatus>(() =>
    socket.connected ? 'connected' : 'connecting',
  );
  // Both the timeout below and socket.io's own retry limit can give up; only
  // the first of them should say so.
  const hasReportedFailure = useRef(false);

  useEffect(() => {
    const giveUp = () => {
      if (hasReportedFailure.current) return;
      hasReportedFailure.current = true;
      toast.error('Could not reach the server. Please try again.');
      setStatus('failed');
    };

    const handleConnect = () => {
      hasReportedFailure.current = false;
      setStatus('connected');
    };

    const handleDisconnect = (reason: string) => {
      // Logging out disconnects deliberately. The navigation away is the
      // point of it, and there is nothing to report.
      if (reason === 'io client disconnect') return;
      toast.error('Your connection to the server has been lost!');
      // socket.io reconnects on its own, so show that rather than
      // bouncing a player out of a room mid-game over one dropped frame.
      setStatus('connecting');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.io.on('reconnect_failed', giveUp);

    if (!socket.connected) {
      socket.connect();
    }

    const giveUpTimer = setTimeout(() => {
      if (!socket.connected) giveUp();
    }, CONNECT_TIMEOUT_MS);

    return () => {
      clearTimeout(giveUpTimer);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.io.off('reconnect_failed', giveUp);
    };
  }, [socket]);

  if (status === 'failed') {
    return <Navigate to="/Gamehub" replace />;
  }

  if (status === 'connecting') {
    return (
      <div className="require-socket-connecting">
        <Spin size="large" />
        <Typography.Text className="require-socket-connecting-text">
          Connecting to the server…
        </Typography.Text>
      </div>
    );
  }

  return <Outlet />;
};

export default RequireSocket;
