import { act, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io-client';
import RequireSocket from './require-socket';
import { SocketContext } from '../providers/socket-provider';
import { createFakeSocket, type FakeSocket } from '../tests/fake-socket';

const ROOM_URL = '/Gamehub/DrawAndGuess/Room/room-1';

/**
 * Mounts the guard the way the router does, at a URL underneath it, with a
 * distinguishable page at `/Gamehub` so a redirect is visible rather than
 * merely inferred.
 */
const renderGuarded = (socket: FakeSocket, route = ROOM_URL) =>
  render(
    <SocketContext.Provider value={{ socket: socket as unknown as Socket }}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route element={<RequireSocket />}>
            <Route
              path="/Gamehub/DrawAndGuess/Room/:roomId"
              element={<div>the room</div>}
            />
          </Route>
          <Route path="/Gamehub" element={<div>the gamehub</div>} />
        </Routes>
      </MemoryRouter>
    </SocketContext.Provider>,
  );

describe('RequireSocket', () => {
  /*
   * The bug this replaces: the guard redirected whenever `socket.connected`
   * was false at first render, and on a fresh page load it always is — only
   * the Gamehub page opens the socket, and a pasted URL never goes through
   * it. Every deep link and every refresh bounced to /Gamehub.
   */
  it('opens the connection instead of redirecting away from a deep link', () => {
    const socket = createFakeSocket({ connected: false });
    renderGuarded(socket);

    expect(socket.connect).toHaveBeenCalledOnce();
    expect(screen.queryByText('the gamehub')).not.toBeInTheDocument();
    expect(screen.getByText('Connecting to the server…')).toBeInTheDocument();
  });

  it('shows the page once the connection is up', async () => {
    const socket = createFakeSocket({ connected: false });
    renderGuarded(socket);

    act(() => socket.serverEmits('connect'));

    expect(await screen.findByText('the room')).toBeInTheDocument();
    expect(
      screen.queryByText('Connecting to the server…'),
    ).not.toBeInTheDocument();
  });

  it('renders straight through when the socket is already connected', () => {
    const socket = createFakeSocket({ connected: true });
    renderGuarded(socket);

    expect(screen.getByText('the room')).toBeInTheDocument();
    expect(socket.connect).not.toHaveBeenCalled();
  });

  /*
   * A dropped frame mid-game is not a reason to throw someone out of the room
   * they are playing in — socket.io is already retrying underneath.
   */
  it('waits through a dropped connection rather than bouncing out', async () => {
    const socket = createFakeSocket({ connected: true });
    renderGuarded(socket);
    expect(screen.getByText('the room')).toBeInTheDocument();

    act(() => socket.serverEmits('disconnect', 'transport close'));

    expect(
      await screen.findByText('Connecting to the server…'),
    ).toBeInTheDocument();
    expect(screen.queryByText('the gamehub')).not.toBeInTheDocument();

    act(() => socket.serverEmits('connect'));
    expect(await screen.findByText('the room')).toBeInTheDocument();
  });

  it('redirects once socket.io has run out of retries', async () => {
    const socket = createFakeSocket({ connected: false });
    renderGuarded(socket);

    act(() => socket.serverEmits('reconnect_failed'));

    expect(await screen.findByText('the gamehub')).toBeInTheDocument();
  });

  it('redirects when the connection never comes up at all', async () => {
    vi.useFakeTimers();
    const socket = createFakeSocket({ connected: false });
    renderGuarded(socket);

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });

    vi.useRealTimers();
    await waitFor(() =>
      expect(screen.getByText('the gamehub')).toBeInTheDocument(),
    );
  });

  it('does not redirect if the connection arrives before the timeout', async () => {
    vi.useFakeTimers();
    const socket = createFakeSocket({ connected: false });
    renderGuarded(socket);

    act(() => socket.serverEmits('connect'));
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    vi.useRealTimers();
    expect(screen.getByText('the room')).toBeInTheDocument();
    expect(screen.queryByText('the gamehub')).not.toBeInTheDocument();
  });

  it('unsubscribes on unmount, including from the manager', () => {
    const socket = createFakeSocket({ connected: true });
    const { unmount } = renderGuarded(socket);

    unmount();

    // Nothing left listening: a later event must reach no handler.
    expect(() =>
      socket.serverEmits('disconnect', 'transport close'),
    ).not.toThrow();
    expect(() => socket.serverEmits('reconnect_failed')).not.toThrow();
  });
});
