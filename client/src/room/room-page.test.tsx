import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Result } from '../../../shared/wire-types';
import { FakeSocket } from '../tests/fake-socket';
import { minesweeperState } from '../tests/fixtures';
import { onPhone } from '../tests/phone';
import { renderApp } from '../tests/render-app';

const ROOM = '/games/minesweeper/rooms/r1';
const ok: Result = { ok: true };
const refused = (
  type:
    | 'notRoomMember'
    | 'incorrectPassword'
    | 'roomNotExist'
    | 'roomNotOpen'
    | 'invalidRequest',
): Result => ({
  ok: false,
  error: { type, message: type },
});

/** A server where this player holds no seat until `room:join` succeeds. */
function server({ password = '' } = {}) {
  const fake = new FakeSocket();
  let seated = false;
  fake.answer('room:sync', () => (seated ? ok : refused('notRoomMember')));
  fake.answer('room:join', (_roomId, _name, given) => {
    if (given !== password) return refused('incorrectPassword');
    seated = true;
    return ok;
  });
  return fake;
}

describe('a room page', () => {
  it('takes a seat when opened from a link', async () => {
    const fake = server();
    await renderApp(ROOM, { fake });

    expect(fake.requests.map((r) => r.event)).toContain('room:join');
    expect(fake.requests.find((r) => r.event === 'room:join')!.args).toEqual([
      'r1',
      'Ryan',
      '',
    ]);
    act(() => fake.serverEmits('room:state', minesweeperState()));

    const bar = screen.getByRole('banner');
    expect(
      within(bar).getByRole('heading', { name: 'Minesweeper' }),
    ).toBeInTheDocument();
    expect(within(bar).getByText('Friday table')).toBeInTheDocument();
    expect(within(bar).getByText('Waiting room')).toBeInTheDocument();
    // A room has no links out but the wordmark, which asks first.
    expect(within(bar).queryByRole('link', { name: 'Games' })).toBeNull();
  });

  it('asks for the password of a private room', async () => {
    const user = userEvent.setup();
    const fake = server({ password: 'turtle' });
    await renderApp(ROOM, { fake });

    expect(screen.getByText('This room has a secret.')).toBeInTheDocument();
    expect(
      screen.queryByText('That password didn’t work. Try again.'),
    ).toBeNull();

    await user.type(screen.getByLabelText('Room password'), 'tortoise');
    await user.click(screen.getByRole('button', { name: 'Join room' }));
    expect(
      await screen.findByText('That password didn’t work. Try again.'),
    ).toBeInTheDocument();
    // Back in the field with the wrong guess selected, ready to retype.
    const field = screen.getByLabelText<HTMLInputElement>('Room password');
    expect(field).toHaveFocus();
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe('tortoise'.length);

    await user.keyboard('turtle');
    await user.click(screen.getByRole('button', { name: 'Join room' }));
    act(() => fake.serverEmits('room:state', minesweeperState()));
    expect(
      screen.getByRole('heading', { name: 'Minesweeper' }),
    ).toBeInTheDocument();
  });

  it('asks for a password straight on the page on a phone', async () => {
    onPhone();
    await renderApp(ROOM, { fake: server({ password: 'turtle' }) });
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'This room has a secret.',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Come on in')).toBeInTheDocument();
    expect(
      screen.getByText('Ask the host for the password.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('form', { name: 'This room has a secret.' }),
    ).toBeInTheDocument();
  });

  it('says so when the room is gone', async () => {
    const fake = new FakeSocket();
    fake.answer('room:sync', () => refused('roomNotExist'));
    await renderApp(ROOM, { fake });
    expect(screen.getByText('This room has packed up.')).toBeInTheDocument();
  });

  it('says the room is gone when the link is mangled', async () => {
    const fake = new FakeSocket();
    fake.answer('room:sync', () => refused('invalidRequest'));
    await renderApp('/games/minesweeper/rooms/not-a-room', { fake });

    expect(
      await screen.findByRole('heading', { name: 'This room has packed up.' }),
    ).toBeInTheDocument();
  });

  it('says so when the room filled up or started', async () => {
    const fake = new FakeSocket();
    fake.answer('room:sync', () => refused('notRoomMember'));
    fake.answer('room:join', () => refused('roomNotOpen'));
    await renderApp(ROOM, { fake });
    expect(screen.getByText('That room moved on.')).toBeInTheDocument();
  });

  it('holds the room through a dropped connection', async () => {
    const fake = server();
    await renderApp(ROOM, { fake });
    act(() => fake.serverEmits('room:state', minesweeperState()));

    act(() => fake.drop());
    expect(screen.getByText(/kept for 30 seconds/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Leave room' })).toBeNull();

    await act(async () => fake.open());
    expect(screen.queryByText(/kept for 30 seconds/)).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Leave room' }),
    ).toBeInTheDocument();
  });

  it('says the seat is gone when it was released while away', async () => {
    const fake = server();
    await renderApp(ROOM, { fake });
    act(() => fake.serverEmits('room:state', minesweeperState()));

    act(() => fake.drop());
    fake.answer('room:sync', () => refused('notRoomMember'));
    await act(async () => fake.open());

    expect(
      screen.getByText('Let’s find you a fresh start.'),
    ).toBeInTheDocument();
    expect(fake.sentArgs('room:leave')).toEqual([]);
  });

  it('invites with the whole link, ready to copy', async () => {
    const user = userEvent.setup();
    const fake = server();
    await renderApp(ROOM, { fake });
    act(() => fake.serverEmits('room:state', minesweeperState()));

    await user.click(
      screen.getAllByRole('button', { name: 'Invite friends' })[0],
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Invite friends',
    });

    expect(
      within(dialog).getByRole('textbox', { name: 'Room link' }),
    ).toHaveValue(`${window.location.origin}${ROOM}`);
    await vi.waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Copy' }),
      ).toHaveFocus(),
    );
  });

  it('leaves at once between games', async () => {
    const user = userEvent.setup();
    const fake = server();
    const { router } = await renderApp(ROOM, { fake });
    act(() => fake.serverEmits('room:state', minesweeperState()));

    await user.click(screen.getByRole('button', { name: 'Leave room' }));

    expect(fake.sentArgs('room:leave')).toEqual([['r1']]);
    expect(router.state.location.pathname).toBe('/games/minesweeper');
  });

  it('asks before leaving a game in progress', async () => {
    const user = userEvent.setup();
    const fake = server();
    const { router } = await renderApp(ROOM, { fake });
    act(() =>
      fake.serverEmits(
        'room:state',
        minesweeperState({ isGameStarted: true, phase: 'picking', round: 1 }),
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Leave room' }));
    const dialog = screen.getByRole('dialog', { name: 'Leave Friday table?' });

    await user.click(within(dialog).getByRole('button', { name: 'Stay' }));
    expect(router.state.location.pathname).toBe(ROOM);
    expect(fake.sentArgs('room:leave')).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Leave room' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Leave room',
      }),
    );
    expect(fake.sentArgs('room:leave')).toEqual([['r1']]);
    expect(router.state.location.pathname).toBe('/games/minesweeper');
  });

  it('asks before the wordmark takes a player out between games', async () => {
    const user = userEvent.setup();
    const fake = server();
    const { router } = await renderApp(ROOM, { fake });
    act(() => fake.serverEmits('room:state', minesweeperState()));

    await user.click(screen.getByRole('link', { name: 'Zumpo home' }));
    const dialog = screen.getByRole('dialog', { name: 'Leave Friday table?' });
    expect(
      within(dialog).getByText(
        'Your seat goes with you. You can join again while a seat is open.',
      ),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Stay' }));
    expect(router.state.location.pathname).toBe(ROOM);
    expect(fake.sentArgs('room:leave')).toEqual([]);

    await user.click(screen.getByRole('link', { name: 'Zumpo home' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Leave room',
      }),
    );
    expect(fake.sentArgs('room:leave')).toEqual([['r1']]);
    expect(router.state.location.pathname).toBe('/');
  });

  it('asks before the wordmark takes a player out of a game', async () => {
    const user = userEvent.setup();
    const fake = server();
    await renderApp(ROOM, { fake });
    act(() =>
      fake.serverEmits(
        'room:state',
        minesweeperState({ isGameStarted: true, phase: 'picking', round: 1 }),
      ),
    );

    await user.click(screen.getByRole('link', { name: 'Zumpo home' }));
    expect(
      within(screen.getByRole('dialog')).getByText(
        /The game carries on without you/,
      ),
    ).toBeInTheDocument();
  });

  it('shows how to play over the room, which stays', async () => {
    const user = userEvent.setup();
    const fake = server();
    const { router } = await renderApp(ROOM, { fake });
    act(() => fake.serverEmits('room:state', minesweeperState()));

    await user.click(screen.getByRole('button', { name: 'How to play' }));
    const dialog = screen.getByRole('dialog', {
      name: 'How to play Minesweeper',
    });
    expect(within(dialog).getAllByRole('listitem').length).toBeGreaterThan(0);

    await user.click(
      within(dialog).getByRole('button', { name: 'Back to the game' }),
    );
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(router.state.location.pathname).toBe(ROOM);
    expect(fake.sentArgs('room:leave')).toEqual([]);
  });
});
