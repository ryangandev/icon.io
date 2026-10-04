import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeSocket } from '../tests/fake-socket';
import { SessionProvider, useConnectedSession, useSession } from './session';

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

const identity = { playerId: 'p1', token: 't1', reconnectGraceMs: 30_000 };

function setup(children = <Status />) {
  const fake = new FakeSocket();
  fake.answer('session:identify', () => identity);
  render(
    <SessionProvider socket={fake.asSocket()}>{children}</SessionProvider>,
  );
  return fake;
}

describe('the session', () => {
  beforeEach(() => sessionStorage.clear());

  it('stays idle until a page needs the server', () => {
    const fake = setup(<Idle />);
    expect(screen.getByText('idle')).toBeInTheDocument();
    expect(fake.active).toBe(false);
  });

  it('identifies on connecting and keeps the identity for this tab', async () => {
    const fake = setup();
    expect(screen.getByText('connecting')).toBeInTheDocument();

    await act(async () => fake.open());

    expect(screen.getByText('online p1')).toBeInTheDocument();
    expect(fake.requests[0]).toEqual({
      event: 'session:identify',
      args: [null],
    });
    expect(JSON.parse(sessionStorage.getItem('zumpo:identity')!)).toEqual({
      playerId: 'p1',
      token: 't1',
    });
  });

  it('claims the stored identity again after a reload', async () => {
    sessionStorage.setItem(
      'zumpo:identity',
      JSON.stringify({ playerId: 'p1', token: 't1' }),
    );
    const fake = setup();
    await act(async () => fake.open());
    expect(fake.requests[0].args).toEqual([{ playerId: 'p1', token: 't1' }]);
  });

  it('says it is reconnecting when an established connection drops', async () => {
    const fake = setup();
    await act(async () => fake.open());

    act(() => fake.drop());
    expect(screen.getByText('reconnecting p1')).toBeInTheDocument();

    await act(async () => fake.open());
    expect(screen.getByText('online p1')).toBeInTheDocument();
    expect(fake.requests).toHaveLength(2);
  });

  it('fails once retries run out, and starts over on request', async () => {
    let session: ReturnType<typeof useSession> | undefined;
    function Capture() {
      session = useConnectedSession();
      return <p>{session.status}</p>;
    }
    const fake = setup(<Capture />);
    await act(async () => fake.open());
    act(() => fake.drop());
    act(() => fake.giveUp());
    expect(screen.getByText('failed')).toBeInTheDocument();

    act(() => session!.connect());
    expect(screen.getByText('connecting')).toBeInTheDocument();
    expect(fake.active).toBe(true);
  });

  it('remembers the chosen name for this tab', () => {
    let session: ReturnType<typeof useSession> | undefined;
    function Capture() {
      session = useSession();
      return <p>name: {session.name}</p>;
    }
    setup(<Capture />);
    act(() => session!.setName('Ryan'));
    expect(screen.getByText('name: Ryan')).toBeInTheDocument();
    expect(sessionStorage.getItem('zumpo:name')).toBe('Ryan');
  });
});
