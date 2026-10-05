import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { HushRoomState } from '../../../shared/wire-types';
import { hushState, ME } from '../tests/fixtures';
import { renderSeated } from '../tests/seated';

/** Ryan (the viewer) and Maya, three cards each, on level 3 of 7. */
const playing: HushRoomState = hushState({
  isGameStarted: true,
  phase: 'playing',
  level: 3,
  lives: 2,
  hand: [41, 77],
  table: {
    p1: { held: 2, ready: true },
    p2: { held: 2, ready: true },
  },
  pile: [
    { card: 9, playerId: 'p2' },
    { card: 34, playerId: ME },
  ],
});

/** What the turn bar says. */
const turn = () => within(screen.getByRole('region', { name: 'Turn' }));
const scoreboard = () =>
  within(screen.getByRole('region', { name: /^Players/ }));
const chatBox = () => screen.getByRole('textbox', { name: 'Message' });

describe('a Hush room', () => {
  it('lets the host start, and says how long the game is', async () => {
    const user = userEvent.setup();
    const { fake } = await renderSeated(hushState());
    fake.answer('game:start', () => ({ ok: true as const }));

    expect(screen.getByText(/^2 players, 7 levels\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    expect(fake.requests.at(-1)).toEqual({ event: 'game:start', args: ['r1'] });
  });

  it('asks everybody to get ready, with the chat open', async () => {
    const user = userEvent.setup();
    const { fake, update } = await renderSeated(
      hushState({
        isGameStarted: true,
        phase: 'ready',
        level: 3,
        lives: 2,
        table: {
          p1: { held: 0, ready: false },
          p2: { held: 0, ready: true },
        },
      }),
    );

    expect(turn().getByText('Level 3 of 7')).toBeInTheDocument();
    expect(turn().getByText('Get ready')).toBeInTheDocument();
    expect(turn().getByText('Maya is ready.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '2 lives' })).toBeInTheDocument();
    expect(scoreboard().getByText('Ready')).toBeInTheDocument();
    expect(scoreboard().getByText('Getting ready')).toBeInTheDocument();
    expect(chatBox()).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'I’m ready' }));
    expect(fake.sentArgs('hush:ready')).toEqual([['r1']]);

    update(
      hushState({
        isGameStarted: true,
        phase: 'ready',
        level: 3,
        lives: 2,
        table: {
          p1: { held: 0, ready: true },
          p2: { held: 0, ready: false },
        },
      }),
    );
    expect(turn().getByText('Waiting for Maya.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'I’m ready' })).toBeNull();
  });

  it('counts down with the hands dealt and the chat locked', async () => {
    await renderSeated({
      ...playing,
      phase: 'countdown',
      phaseEndsInMs: 3_000,
      pile: [],
      hand: [14, 41, 77],
      table: {
        p1: { held: 3, ready: true },
        p2: { held: 3, ready: true },
      },
    });

    expect(turn().getByText('Hush')).toBeInTheDocument();
    expect(turn().getByText('Everybody holds 3 cards.')).toBeInTheDocument();
    expect(turn().getByText('to start')).toBeInTheDocument();
    expect(screen.getByText('Play opens in a moment.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Play/ })).toBeNull();
    expect(chatBox()).toBeDisabled();
    expect(chatBox()).toHaveAttribute(
      'placeholder',
      'Hush. Chat opens when the level ends.',
    );
  });

  it('plays your lowest card, and only that, with no clock', async () => {
    const user = userEvent.setup();
    const { fake } = await renderSeated(playing);

    expect(screen.queryByRole('timer')).toBeNull();
    expect(
      turn().getByText('Play your lowest card when it feels right.'),
    ).toBeInTheDocument();
    const hand = within(screen.getByRole('region', { name: 'Your hand' }));
    expect(hand.getAllByRole('img').map((card) => card.textContent)).toEqual([
      '41',
      '77',
    ]);
    // The pile shows its top card, and the cards under it.
    const pile = within(screen.getByRole('region', { name: 'The pile' }));
    expect(pile.getByRole('img', { name: '34' })).toBeInTheDocument();
    expect(pile.getByRole('img', { name: '9' })).toBeInTheDocument();
    expect(screen.getByText('4 cards to go')).toBeInTheDocument();
    expect(scoreboard().getAllByText('2 cards')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Play 41' }));
    expect(fake.sentArgs('hush:play')).toEqual([['r1', 41]]);
    expect(chatBox()).toBeDisabled();
  });

  it('shows a mistake: who played what, and what was lost', async () => {
    await renderSeated({
      ...playing,
      phase: 'mistake',
      phaseEndsInMs: 3_000,
      lives: 1,
      hand: [77],
      table: {
        p1: { held: 1, ready: true },
        p2: { held: 1, ready: true },
      },
      pile: [...playing.pile, { card: 52, playerId: 'p2' }],
      discards: [{ card: 47, playerId: ME, reason: 'mistake' }],
      lastMistake: {
        playerId: 'p2',
        card: 52,
        discarded: [{ card: 47, playerId: ME, reason: 'mistake' }],
      },
    });

    expect(turn().getByText('Maya played 52')).toBeInTheDocument();
    expect(
      turn().getByText('You still held 47. One life lost.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: '47, discarded' }),
    ).toBeInTheDocument();
    expect(scoreboard().getByText('Lost 47, 1 card left')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '1 life' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Play/ })).toBeNull();
  });

  it('pauses for a player who dropped holding cards', async () => {
    await renderSeated({
      ...playing,
      phase: 'paused',
      phaseEndsInMs: 24_000,
      playerList: {
        ...playing.playerList,
        p2: { username: 'Maya', points: 2, isConnected: false },
      },
    });

    expect(turn().getByText('Paused')).toBeInTheDocument();
    expect(
      turn().getByText('Waiting for Maya, who still holds 2 cards.'),
    ).toBeInTheDocument();
    expect(turn().getByText('seat held')).toBeInTheDocument();
    expect(scoreboard().getByText('Away, 2 cards')).toBeInTheDocument();
    expect(
      screen.getByText('Play goes on with a countdown when Maya is back.'),
    ).toBeInTheDocument();
  });

  it('shows a clean level and the life it won back, with the chat open', async () => {
    await renderSeated({
      ...playing,
      phase: 'cleared',
      phaseEndsInMs: 4_000,
      lives: 3,
      hand: [],
      table: {
        p1: { held: 0, ready: true },
        p2: { held: 0, ready: true },
      },
      lastLevel: { level: 3, livesLost: 0, lifeBack: true, cleared: true },
    });

    expect(turn().getByText('Level cleared!')).toBeInTheDocument();
    expect(turn().getByText('Not one slip: a life back.')).toBeInTheDocument();
    expect(turn().getByText('to level 4')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Level 4 deals 4 cards each. Everyone presses Ready again.',
      ),
    ).toBeInTheDocument();
    expect(chatBox()).toBeEnabled();
  });

  it('never shows a score: the team scores together', async () => {
    await renderSeated(playing);
    for (const row of scoreboard().getAllByRole('listitem')) {
      expect(row.textContent).not.toMatch(/\d$/);
    }
  });

  it('shows a won game level by level, without ranking anybody', async () => {
    await renderSeated(
      hushState({
        levels: 7,
        pile: [
          { card: 12, playerId: ME },
          { card: 58, playerId: 'p2' },
        ],
        lastGame: {
          endedEarly: false,
          standings: [
            { playerId: ME, username: 'Ryan', points: 2 },
            { playerId: 'p2', username: 'Maya', points: 2 },
          ],
          levels: 2,
          levelsCleared: 2,
          won: true,
          lives: 2,
          history: [
            { level: 1, livesLost: 1, lifeBack: false, cleared: true },
            { level: 2, livesLost: 0, lifeBack: true, cleared: true },
          ],
          held: [],
        },
      }),
    );

    expect(
      screen.getByRole('heading', { name: 'All 2 levels cleared.' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Together, with 2 lives to spare.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Level 1: a life lost')).toBeInTheDocument();
    expect(screen.getByText('Level 2: clean, a life back')).toBeInTheDocument();
    expect(screen.queryByText('Winner')).toBeNull();
    expect(screen.getByRole('img', { name: '58' })).toBeInTheDocument();
  });

  it('shows every card still held when the lives run out', async () => {
    await renderSeated(
      hushState({
        lastGame: {
          endedEarly: false,
          standings: [
            { playerId: ME, username: 'Ryan', points: 0 },
            { playerId: 'p2', username: 'Maya', points: 0 },
          ],
          levels: 7,
          levelsCleared: 0,
          won: false,
          lives: 0,
          history: [
            { level: 1, livesLost: 3, lifeBack: false, cleared: false },
          ],
          held: [{ playerId: 'p2', cards: [79, 93] }],
        },
      }),
    );

    expect(
      screen.getByRole('heading', { name: 'Out of lives on level 1.' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('0 of 7 levels cleared, together.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Level 1: the last life lost')).toBeInTheDocument();
    const held = within(screen.getByRole('list', { name: 'Maya held' }));
    expect(held.getAllByRole('img').map((card) => card.textContent)).toEqual([
      '79',
      '93',
    ]);
    expect(screen.getByText('Nothing left')).toBeInTheDocument();
  });
});
