import { act, render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../app';
import { SessionProvider } from '../net/session';
import { ME } from './fixtures';
import { FakeSocket } from './fake-socket';

/**
 * The whole app at `path`, talking to a fake server, with a player who has
 * already chosen a name unless `name` says otherwise.
 */
export async function renderApp(
  path: string,
  {
    name = 'Ryan',
    fake = new FakeSocket(),
  }: { name?: string; fake?: FakeSocket } = {},
) {
  sessionStorage.clear();
  if (name) sessionStorage.setItem('zumpo:name', name);
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
