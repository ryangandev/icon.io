import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { drawAndGuessState, ME } from '../tests/fixtures';
import { renderSeated } from '../tests/seated';

const turn = {
  isGameStarted: true,
  currentRound: 1,
  turn: 1,
  wordCategory: 'Animals' as const,
  phaseEndsInMs: 60_000,
};

describe('a Draw & Guess room', () => {
  it('offers the drawer their words, and only the drawer', async () => {
    const user = userEvent.setup();
    const { fake } = await renderSeated(
      drawAndGuessState({
        ...turn,
        phase: 'choosing',
        currentDrawer: ME,
        wordChoices: ['turtle', 'zebra', 'owl'],
      }),
    );

    expect(screen.getByText('Pick a word')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /zebra/ }));
    expect(fake.sentArgs('dg:select-word')).toEqual([['r1', 'zebra']]);
  });

  it('tells a guesser who is choosing', async () => {
    await renderSeated(
      drawAndGuessState({ ...turn, phase: 'choosing', currentDrawer: 'p2' }),
    );
    expect(screen.getByText('Maya is choosing a word')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /turtle/ })).toBeNull();
  });

  it('keeps the drawer out of the chat while they draw', async () => {
    await renderSeated(
      drawAndGuessState({
        ...turn,
        phase: 'drawing',
        currentDrawer: ME,
        word: 'turtle',
        hint: '_ _ _ _ _ _',
      }),
    );
    expect(screen.getByText('turtle')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('textbox')).toHaveAttribute(
      'placeholder',
      'You’re drawing. Chat opens after your turn.',
    );
  });

  it('sends a guess through the chat', async () => {
    const user = userEvent.setup();
    const { fake } = await renderSeated(
      drawAndGuessState({
        ...turn,
        phase: 'drawing',
        currentDrawer: 'p2',
        hint: '_ _ _ _ _ _',
      }),
    );
    const input = screen.getByPlaceholderText('Type your guess…');
    await user.type(input, 'turtle{Enter}');
    expect(fake.sentArgs('chat:send')).toEqual([['r1', 'turtle']]);
  });

  it('keeps a player who scored quiet through the review', async () => {
    await renderSeated(
      drawAndGuessState({
        ...turn,
        phase: 'reveal',
        currentDrawer: 'p2',
        word: 'turtle',
        scoredThisTurn: [ME],
        turnPoints: { [ME]: 120, p2: 48 },
      }),
    );
    expect(screen.getByRole('textbox')).toHaveAttribute(
      'placeholder',
      'You got it. Chat opens next turn.',
    );
  });
});
