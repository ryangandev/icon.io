import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Result } from '../../../shared/wire-types';
import { FakeSocket } from '../tests/fake-socket';
import { minesweeperState } from '../tests/fixtures';
import { renderApp } from '../tests/render-app';

const ROOM = '/games/minesweeper/rooms/r1';
const ok: Result = { ok: true };
const refused = (
  type: 'notRoomMember' | 'incorrectPassword' | 'roomNotExist' | 'roomNotOpen',
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

    expect(
      screen.getByRole('heading', { name: 'Minesweeper' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Small 9 × 9 board, up to 8 players'),
    ).toBeInTheDocument();
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

  it('says so when the room is gone', async () => {
    const fake = new FakeSocket();
    fake.answer('room:sync', () => refused('roomNotExist'));
    await renderApp(ROOM, { fake });
    expect(screen.getByText('This room has packed up.')).toBeInTheDocument();
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
    expect(screen.getByText('A little pause.')).toBeInTheDocument();
    expect(screen.getByText(/kept for 30 seconds/)).toBeInTheDocument();

    await act(async () => fake.open());
    expect(
      screen.getByRole('heading', { name: 'Minesweeper' }),
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
});
