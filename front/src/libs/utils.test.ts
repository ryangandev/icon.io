import { describe, expect, it } from 'vitest';
import {
  formatTimeInMinutesAndSeconds,
  sortPlayerListByPoints,
  statusColors,
} from './utils';
import type { PlayerInfo } from '../models/types';

describe('formatTimeInMinutesAndSeconds', () => {
  it('pads both halves to two digits', () => {
    expect(formatTimeInMinutesAndSeconds(0)).toBe('00:00');
    expect(formatTimeInMinutesAndSeconds(9)).toBe('00:09');
    expect(formatTimeInMinutesAndSeconds(65)).toBe('01:05');
  });

  it('rolls a whole minute over', () => {
    expect(formatTimeInMinutesAndSeconds(60)).toBe('01:00');
    expect(formatTimeInMinutesAndSeconds(599)).toBe('09:59');
    expect(formatTimeInMinutesAndSeconds(600)).toBe('10:00');
  });
});

const player = (username: string, points: number): PlayerInfo => ({
  username,
  points,
  receivedPointsThisTurn: false,
});

describe('sortPlayerListByPoints', () => {
  it('puts the highest score first', () => {
    const sorted = sortPlayerListByPoints({
      a: player('Ada', 100),
      b: player('Grace', 340),
      c: player('Alan', 220),
    });

    expect(sorted.map(([, info]) => info.username)).toEqual([
      'Grace',
      'Alan',
      'Ada',
    ]);
  });

  it('keeps the socket id alongside each player', () => {
    const sorted = sortPlayerListByPoints({ 'socket-1': player('Ada', 10) });

    expect(sorted[0][0]).toBe('socket-1');
  });

  it('handles an empty room', () => {
    expect(sortPlayerListByPoints({})).toEqual([]);
  });
});

describe('statusColors', () => {
  it('covers every room status the server can report', () => {
    expect(Object.keys(statusColors).toSorted()).toEqual([
      'Full',
      'In Progress',
      'Open',
    ]);
  });
});
