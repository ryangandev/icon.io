import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ME, minesweeperState } from '../tests/fixtures';
import { onPhone } from '../tests/phone';
import { renderSeated } from '../tests/seated';

const picking = minesweeperState({
  isGameStarted: true,
  phase: 'picking',
  round: 1,
  phaseEndsInMs: 15_000,
});

const pick = {
  playerId: ME,
  username: 'Ryan',
  index: 0,
  risk: 0.23,
  hitMine: false,
  points: 31,
  sharedWith: 1,
  autoPlayed: false,
};

/** The celebration's canvas; the room has no other. */
const confetti = () => document.querySelector('canvas[aria-hidden]');

describe('a Minesweeper room', () => {
  it('lets the host start once two players are in', async () => {
    const user = userEvent.setup();
    const { fake } = await renderSeated(minesweeperState());
    fake.answer('game:start', () => ({ ok: true as const }));

    expect(screen.getByText('Everyone’s here?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    expect(fake.requests.at(-1)).toEqual({ event: 'game:start', args: ['r1'] });
  });

  it('locks in one pick per round', async () => {
    const user = userEvent.setup();
    const { fake, update } = await renderSeated(picking);

    expect(screen.getByText('Pick a cell')).toBeInTheDocument();
    expect(
      screen.getByText('10 mines · your pick locks when you click'),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Row 1, column 3: hidden' }),
    );
    expect(fake.sentArgs('ms:pick')).toEqual([['r1', 2]]);

    update({ ...picking, myPick: 2, lockedIn: [ME] });
    expect(
      screen.getByText('Locked in', { selector: '*:not(li *)' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Waiting for Maya')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Row 1, column 1/ }),
    ).toBeNull();
  });

  it('shows what each pick was worth', async () => {
    await renderSeated({
      ...picking,
      phase: 'reveal',
      phaseEndsInMs: 4_000,
      lockedIn: [ME, 'p2'],
      board: picking.board.map((cell, index) => (index === 0 ? 1 : cell)),
      lastRound: [
        pick,
        {
          ...pick,
          playerId: 'p2',
          username: 'Maya',
          index: 40,
          risk: 0.15,
          hitMine: true,
          points: -105,
        },
      ],
    });

    expect(screen.getByText('Safe! +31')).toBeInTheDocument();
    expect(screen.getByText('Your cell had a 23% risk')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Round 1 results' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Hit a mine · −105')).toBeInTheDocument();
  });

  it('says when the clock picked for the player', async () => {
    await renderSeated({
      ...picking,
      phase: 'reveal',
      lastRound: [{ ...pick, risk: 0, points: 0, autoPlayed: true }],
    });
    expect(screen.getByText('Time ran out')).toBeInTheDocument();
    expect(
      screen.getByText('The safest cell was picked for you: 0% risk, so +0'),
    ).toBeInTheDocument();
  });

  it('names who shared a cell', async () => {
    await renderSeated({
      ...picking,
      phase: 'reveal',
      lastRound: [
        { ...pick, sharedWith: 2 },
        { ...pick, playerId: 'p2', username: 'Maya', sharedWith: 2 },
      ],
    });
    expect(
      screen.getByText(
        'You and Maya picked the same cell, so you split its reward',
      ),
    ).toBeInTheDocument();
  });

  it('keeps the last results to the reveal on a phone', async () => {
    onPhone();
    const { update } = await renderSeated({
      ...picking,
      phase: 'reveal',
      lastRound: [pick],
    });
    expect(
      screen.getByRole('heading', { name: 'Round 1 results' }),
    ).toBeInTheDocument();

    update({ ...picking, round: 2, lastRound: [pick] });
    expect(screen.getByText('Pick a cell')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /results/ })).toBeNull();
  });

  it('celebrates a game that ends while the room is open', async () => {
    const ended = minesweeperState({
      lastGame: {
        endedEarly: false,
        standings: [{ playerId: ME, username: 'Ryan', points: 120 }],
        difficulty: 'Small',
        rounds: 6,
      },
    });
    const { update } = await renderSeated(ended);
    expect(confetti()).toBeNull();

    update(picking);
    update(ended);
    expect(
      screen.getByRole('heading', { name: 'Ryan wins with 120 points.' }),
    ).toBeInTheDocument();
    expect(confetti()).not.toBeNull();
  });
});
