import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeSocket } from '../tests/fake-socket';
import { LocaleProvider } from '../i18n';
import { SessionProvider, useConnectedSession, useSession } from './session';
import { createSocket } from './socket';

function Status() {
  const { status, playerId } = useConnectedSession();
  return (
    <p>
      {status} {playerId}
    </p>
  );
}

function Idle() {
  return <p>{useSession().status}</p>;
}

/** Starts over on a click, as the failure page's Try again does. */
function Retry() {
  const { status, connect } = useConnectedSession();
  return <button onClick={connect}>{status}</button>;
}

function Naming() {
  const { name, namePicked, setName } = useSession();
  return (
    <button onClick={() => setName(' Ryan ')}>
      name: {name} {namePicked ? 'picked' : 'chosen'}
    </button>
  );
}

function setup(children = <Status />) {
  const fake = new FakeSocket();
  render(
    <LocaleProvider>
      <SessionProvider socket={fake.asSocket()}>{children}</SessionProvider>
    </LocaleProvider>,
  );
  return fake;
}

describe('the session', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('still connects after a development double mount', () => {
    const fake = new FakeSocket();
    render(
      <StrictMode>
        <LocaleProvider>
          <SessionProvider socket={fake.asSocket()}>
            <Status />
          </SessionProvider>
        </LocaleProvider>
      </StrictMode>,
    );
    expect(fake.active).toBe(true);
    expect(screen.getByText('connecting')).toBeInTheDocument();
  });

  it('stays idle until a page needs the server', () => {
    const fake = setup(<Idle />);
    expect(screen.getByText('idle')).toBeInTheDocument();
    expect(fake.active).toBe(false);
  });

  it('goes online once the server says who it is, and keeps that for this tab', async () => {
    const fake = setup();
    expect(screen.getByText('connecting')).toBeInTheDocument();

    await act(async () => fake.open());

    expect(screen.getByText('online p1')).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem('zumpo:identity')!)).toEqual({
      playerId: 'p1',
      token: 't1',
    });
  });

  it('presents the stored identity in every handshake', () => {
    const socket = createSocket();
    const auth = socket.auth as (send: (data: object) => void) => void;
    const presented: object[] = [];

    auth((data) => presented.push(data));
    sessionStorage.setItem(
      'zumpo:identity',
      JSON.stringify({ playerId: 'p1', token: 't1' }),
    );
    auth((data) => presented.push(data));

    expect(presented).toEqual([
      { identity: null },
      { identity: { playerId: 'p1', token: 't1' } },
    ]);
  });

  it('says it is reconnecting when an established connection drops', async () => {
    const fake = setup();
    await act(async () => fake.open());

    act(() => fake.drop());
    expect(screen.getByText('reconnecting p1')).toBeInTheDocument();

    await act(async () => fake.open());
    expect(screen.getByText('online p1')).toBeInTheDocument();
  });

  it('fails once retries run out, and starts over on request', async () => {
    const fake = setup(<Retry />);
    await act(async () => fake.open());
    act(() => fake.drop());
    act(() => fake.giveUp());
    expect(screen.getByText('failed')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('connecting')).toBeInTheDocument();
    expect(fake.active).toBe(true);
  });

  it('waits after another tab takes over, and takes it back on request', async () => {
    const fake = setup(<Retry />);
    await act(async () => fake.open());

    act(() => fake.serverEmits('session:replaced'));
    act(() => fake.drop('io server disconnect'));
    // Reconnecting on its own would take the identity back from the other
    // tab, which would take it back in turn.
    expect(screen.getByText('replaced')).toBeInTheDocument();
    expect(fake.active).toBe(false);

    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('connecting')).toBeInTheDocument();
    expect(fake.active).toBe(true);
    await act(async () => fake.open());
    expect(screen.getByText('online')).toBeInTheDocument();
  });

  it('reconnects by itself when the server closes the connection', async () => {
    const fake = setup();
    await act(async () => fake.open());

    act(() => fake.drop('io server disconnect'));
    expect(screen.getByText('reconnecting p1')).toBeInTheDocument();
    expect(fake.active).toBe(true);
  });

  it('picks a name on a first visit and keeps it for the next', () => {
    const first = render(
      <LocaleProvider>
        <SessionProvider socket={new FakeSocket().asSocket()}>
          <Naming />
        </SessionProvider>
      </LocaleProvider>,
    );
    const picked = screen.getByRole('button').textContent;
    expect(picked).toMatch(/^name: \w+ \w+ picked$/);
    first.unmount();

    setup(<Naming />);
    expect(screen.getByRole('button')).toHaveTextContent(picked!);
  });

  it('remembers a chosen name for this browser and renames every seat', async () => {
    const fake = setup(<Naming />);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('name: Ryan chosen')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('zumpo:name')!)).toEqual({
      name: 'Ryan',
      picked: false,
    });
    expect(fake.sentArgs('player:rename')).toEqual([
      ['Ryan', expect.any(Function)],
    ]);
  });
});
