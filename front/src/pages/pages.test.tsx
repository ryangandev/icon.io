import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { MinesweeperLobbyRoomInfo } from '../../../shared/wire-types';
import { renderApp } from '../tests/render-app';

const lobbyRoom: MinesweeperLobbyRoomInfo = {
  gameType: 'minesweeper',
  roomId: 'r1',
  roomName: 'Friday table',
  owner: { username: 'Maya', playerId: 'p2' },
  status: 'Open',
  currentPlayerCount: 1,
  maxPlayers: 8,
  hasPassword: false,
  difficulty: 'Small',
};

describe('choosing a name', () => {
  it('is asked for before any game page', async () => {
    const { router } = await renderApp('/games/minesweeper', { name: '' });
    expect(router.state.location.pathname).toBe('/name');
    expect(router.state.location.search).toBe('?next=%2Fgames%2Fminesweeper');
  });

  it('needs a visible character, then continues where the player was going', async () => {
    const user = userEvent.setup();
    const { router } = await renderApp('/name?next=%2Fgames%2Fminesweeper', {
      name: '',
    });

    await user.type(screen.getByLabelText('Your name'), '   ');
    await user.click(screen.getByRole('button', { name: 'Let’s play' }));
    expect(
      screen.getByText('Enter a name with at least one visible character.'),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText('Your name'), ' Ryan ');
    await user.click(screen.getByRole('button', { name: 'Let’s play' }));
    expect(router.state.location.pathname).toBe('/games/minesweeper');
    expect(sessionStorage.getItem('zumpo:name')).toBe('Ryan');
  });

  it('never continues to another site', async () => {
    const user = userEvent.setup();
    const { router } = await renderApp('/name?next=%2F%2Fevil.example', {
      name: '',
    });
    await user.type(screen.getByLabelText('Your name'), 'Ryan');
    await user.click(screen.getByRole('button', { name: 'Let’s play' }));
    expect(router.state.location.pathname).toBe('/games');
  });
});

describe('a lobby', () => {
  it('lists the rooms live and joins one', async () => {
    const user = userEvent.setup();
    const { fake, router } = await renderApp('/games/minesweeper');
    expect(fake.sentArgs('lobby:subscribe')).toEqual([['minesweeper']]);
    expect(screen.getByText('Finding your people…')).toBeInTheDocument();

    act(() => fake.serverEmits('lobby:rooms', 'minesweeper', [lobbyRoom]));
    const row = screen.getByRole('article', { name: 'Friday table' });
    expect(screen.getByText('1 room · Updates live')).toBeInTheDocument();

    await user.click(within(row).getByRole('button', { name: 'Join' }));
    expect(router.state.location.pathname).toBe('/games/minesweeper/rooms/r1');
    expect(fake.sentArgs('lobby:unsubscribe')).toEqual([['minesweeper']]);
  });

  it('ignores another game’s rooms', async () => {
    const { fake } = await renderApp('/games/minesweeper');
    act(() => fake.serverEmits('lobby:rooms', 'draw-and-guess', []));
    expect(screen.getByText('Finding your people…')).toBeInTheDocument();
  });

  it('says so when a game does not exist', async () => {
    await renderApp('/games/chess');
    expect(screen.getByText('A little lost?')).toBeInTheDocument();
  });
});
