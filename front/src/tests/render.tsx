import type { ReactElement } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { SocketContext } from '../providers/socket-provider';
import { createFakeSocket, type FakeSocket } from './fake-socket';
import type { Socket } from 'socket.io-client';

interface RenderWithSocketOptions {
  socket?: FakeSocket;
  /** Who the server says we are; room state is keyed by this. */
  playerId?: string;
  /** Initial URL, so a test can arrive the way a deep link would. */
  route?: string;
  /** The route pattern the element is mounted at, when it reads params. */
  path?: string;
  /** Rendered for any other path, to show where a redirect landed. */
  elsewhere?: ReactElement;
}

interface RenderWithSocketResult extends RenderResult {
  socket: FakeSocket;
}

/**
 * Renders a component with a socket in context and a router around it, which is
 * the least a page in this app needs to mount at all.
 *
 * antd portals its modals into `#app`, so that element has to exist before
 * anything renders — the real one is in `index.html`.
 */
const renderWithSocket = (
  ui: ReactElement,
  {
    socket = createFakeSocket(),
    playerId = 'player-under-test',
    route = '/',
    path = '*',
    elsewhere,
  }: RenderWithSocketOptions = {},
): RenderWithSocketResult => {
  if (!document.getElementById('app')) {
    const appRoot = document.createElement('div');
    appRoot.id = 'app';
    document.body.appendChild(appRoot);
  }

  const result = render(
    <SocketContext.Provider
      value={{ socket: socket as unknown as Socket, playerId }}
    >
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
          {elsewhere && <Route path="*" element={elsewhere} />}
        </Routes>
      </MemoryRouter>
    </SocketContext.Provider>,
  );

  return { ...result, socket };
};

export { renderWithSocket };
