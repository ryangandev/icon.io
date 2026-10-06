import { act, render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../app';
import { SessionProvider } from '../net/session';
import { ME } from './fixtures';
import { FakeSocket } from './fake-socket';

/**
 * The whole app at `path`, talking to a fake server, with a player who has
 * chosen `name` themselves. `picked` makes it the name picked for them, with
 * the hint about it already seen; `firstVisit` stores nothing at all.
 */
export async function renderApp(
  path: string,
  {
    name = 'Ryan',
    picked = false,
    firstVisit = false,
    fake = new FakeSocket(),
  }: {
    name?: string;
    picked?: boolean;
    firstVisit?: boolean;
    fake?: FakeSocket;
  } = {},
) {
  sessionStorage.clear();
  if (firstVisit) {
    localStorage.removeItem('zumpo:name');
    localStorage.removeItem('zumpo:name-hint');
  } else {
    localStorage.setItem('zumpo:name', JSON.stringify({ name, picked }));
    localStorage.setItem('zumpo:name-hint', 'seen');
  }
  fake.session = { playerId: ME, token: 't1', reconnectGraceMs: 30_000 };
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <SessionProvider socket={fake.asSocket()}>
      <RouterProvider router={router} />
    </SessionProvider>,
  );
  // Connect, as the server would accept the handshake.
  await act(async () => {
    if (fake.active) fake.open();
  });
  return { ...view, fake, router };
}
