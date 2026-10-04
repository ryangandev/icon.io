import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Countdown, formatClock } from './countdown';

describe('formatClock', () => {
  it('shows minutes and seconds, zero padded', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(5)).toBe('00:05');
    expect(formatClock(72)).toBe('01:12');
  });

  it('rounds a part second up, so the clock never shows 0 while time is left', () => {
    expect(formatClock(4.2)).toBe('00:05');
    expect(formatClock(0.1)).toBe('00:01');
  });

  it('never goes below zero', () => {
    expect(formatClock(-3)).toBe('00:00');
  });
});

describe('Countdown', () => {
  it('reads as one timer with its purpose', () => {
    render(<Countdown seconds={15} label="to pick" />);
    expect(screen.getByRole('timer')).toHaveTextContent('00:15to pick');
  });
});
