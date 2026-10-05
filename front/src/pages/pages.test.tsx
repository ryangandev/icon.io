import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { MinesweeperLobbyRoomInfo } from '../../../shared/wire-types';
import { onPhone } from '../tests/phone';
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
    expect(screen.getByLabelText('Your name')).toHaveFocus();

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

/** A game's rules on How to play, by its name. */
const rules = (name: string) => within(screen.getByRole('region', { name }));

describe('how to play', () => {
  it('offers each game its ways in beside its rules', async () => {
    await renderApp('/how-to-play', { name: '' });

    expect(
      rules('Draw & Guess').getByRole('link', { name: 'Find a room' }),
    ).toHaveAttribute('href', '/games/draw-and-guess');
    expect(
      rules('Draw & Guess').queryByRole('link', { name: 'Play solo' }),
    ).toBeNull();
    for (const [name, type] of [
      ['Minesweeper', 'minesweeper'],
      ['Make 24', 'make-24'],
      ['Pairs', 'pairs'],
    ]) {
      expect(
        rules(name).getByRole('link', { name: 'Play solo' }),
      ).toHaveAttribute('href', `/games/${type}/solo`);
      expect(
        rules(name).getByRole('link', { name: 'Find a room' }),
      ).toHaveAttribute('href', `/games/${type}`);
    }
  });
});

describe('making a room', () => {
  it('asks for a name before it sends anything', async () => {
    const user = userEvent.setup();
    const { fake } = await renderApp('/games/minesweeper/new');
    await user.clear(screen.getByLabelText('Room name'));
    await user.click(screen.getByRole('button', { name: 'Create room' }));
    expect(screen.getByText('Give your room a name.')).toBeInTheDocument();
    expect(screen.getByLabelText('Room name')).toHaveFocus();
    expect(fake.requests).not.toContainEqual(
      expect.objectContaining({ event: 'room:create' }),
    );
  });

  it('makes a Pairs room on the board picked, with up to six seats', async () => {
    const user = userEvent.setup();
    const { fake } = await renderApp('/games/pairs/new');
    expect(screen.getByText('Choose 2–6 seats.')).toBeInTheDocument();
    expect(screen.getByText('4 × 4 · 8 pairs')).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Board' }));
    await user.click(await screen.findByRole('option', { name: /^Large/ }));
    await user.click(screen.getByRole('button', { name: 'Create room' }));

    await waitFor(() =>
      expect(fake.requests).toContainEqual({
        event: 'room:create',
        args: [
          expect.objectContaining({
            gameType: 'pairs',
            maxPlayers: 6,
            settings: { board: 'Large' },
          }),
        ],
      }),
    );
  });
});

describe('on a phone', () => {
  it('keeps one way in on the front door', async () => {
    onPhone();
    await renderApp('/');
    expect(screen.getByText('A little play')).toBeInTheDocument();
    expect(
      screen.getByText('Good games for good company.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Let’s play' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Browse games' })).toBeNull();
    expect(screen.queryByText(/Play solo starts at once/)).toBeNull();
  });

  it('greets the player above the games', async () => {
    onPhone();
    await renderApp('/games', { name: 'Maya' });
    expect(screen.getByText('Hey, Maya')).toBeInTheDocument();
    expect(
      screen.getByText(/little games, alone or together\./),
    ).toBeInTheDocument();
  });

  it('asks for a name straight on the page', async () => {
    onPhone();
    await renderApp('/name', { name: '' });
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'What should we call you?',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('A little step before the fun.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Up to 18 characters. No signup.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('form', { name: 'What should we call you?' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Your name will appear in rooms, chat, and scores.'),
    ).toBeNull();
  });

  it('counts the rooms in the heading', async () => {
    onPhone();
    const { fake } = await renderApp('/games/minesweeper');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Find your room.' }),
    ).toBeInTheDocument();
    act(() => fake.serverEmits('lobby:rooms', 'minesweeper', [lobbyRoom]));
    expect(screen.getByText('Minesweeper · 1 room')).toBeInTheDocument();
    expect(screen.queryByText('1 room · Updates live')).toBeNull();
  });

  it('makes a room straight on the page', async () => {
    onPhone();
    await renderApp('/games/minesweeper/new');
    expect(
      screen.getByRole('heading', { level: 1, name: 'A little room for you.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Make a room')).toBeInTheDocument();
    expect(screen.getByText('Minesweeper · room settings')).toBeInTheDocument();
    expect(
      screen.getByRole('form', { name: 'A little room for you.' }),
    ).toBeInTheDocument();
  });
});
