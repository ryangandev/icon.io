import { beforeEach, describe, expect, it } from 'vitest';
import { writeStored } from '../../solo/device-store';
import {
  FIRST_PICKS,
  readPicks,
  readRecord,
  recordGame,
  writePicks,
} from './record';

beforeEach(() => {
  localStorage.clear();
});

describe('the record on this device', () => {
  it('starts empty', () => {
    expect(readRecord()).toEqual({ wins: 0, games: 0, run: 0 });
  });

  it('counts wins and games, and the current run of wins', () => {
    recordGame(true);
    recordGame(true);
    expect(readRecord()).toEqual({ wins: 2, games: 2, run: 2 });
    expect(recordGame(false)).toEqual({ wins: 2, games: 3, run: 0 });
    expect(recordGame(true)).toEqual({ wins: 3, games: 4, run: 1 });
  });

  it('ignores a record that does not add up', () => {
    writeStored('record:liars-dice', '{"wins":5,"games":2,"run":1}');
    expect(readRecord()).toEqual({ wins: 0, games: 0, run: 0 });
    writeStored('record:liars-dice', 'not json');
    expect(readRecord()).toEqual({ wins: 0, games: 0, run: 0 });
  });
});

describe('the last table picked', () => {
  it('is three bots with three dice each before any game', () => {
    expect(readPicks()).toEqual(FIRST_PICKS);
    expect(FIRST_PICKS).toEqual({ bots: 3, dicePerPlayer: 3 });
  });

  it('is offered again next time', () => {
    writePicks({ bots: 5, dicePerPlayer: 5 });
    expect(readPicks()).toEqual({ bots: 5, dicePerPlayer: 5 });
  });

  it('falls back on a first game’s for anything it cannot use', () => {
    writeStored('picks:liars-dice', '{"bots":9,"dicePerPlayer":4}');
    expect(readPicks()).toEqual(FIRST_PICKS);
    writeStored('picks:liars-dice', '{"bots":1}');
    expect(readPicks()).toEqual({ bots: 1, dicePerPlayer: 3 });
  });
});
