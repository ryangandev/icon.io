import {
  isDicePerPlayer,
  type DicePerPlayer,
} from '../../../../shared/liars-dice';
import { readStored, writeStored } from '../../solo/device-store';
import { MAX_BOTS, MIN_BOTS, type SoloPicks } from './game';

/**
 * What Liar's Dice on your own keeps on this device: your wins, the games you
 * finished, your current run of wins, and the last table you picked.
 */
export interface LiarsDiceRecord {
  wins: number;
  games: number;
  /** Wins in a row, up to the last game. */
  run: number;
}

const RECORD = 'record:liars-dice';
const PICKS = 'picks:liars-dice';

const NO_RECORD: LiarsDiceRecord = { wins: 0, games: 0, run: 0 };

/** A first game: three bots, three dice each. */
export const FIRST_PICKS: SoloPicks = { bots: 3, dicePerPlayer: 3 };

const isCount = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0;

function readJson(key: string): unknown {
  try {
    return JSON.parse(readStored(key) ?? 'null');
  } catch {
    return null;
  }
}

export function readRecord(): LiarsDiceRecord {
  const stored = readJson(RECORD) as Partial<LiarsDiceRecord> | null;
  if (
    stored &&
    isCount(stored.wins) &&
    isCount(stored.games) &&
    isCount(stored.run) &&
    stored.wins <= stored.games &&
    stored.run <= stored.wins
  ) {
    return { wins: stored.wins, games: stored.games, run: stored.run };
  }
  return { ...NO_RECORD };
}

/** Counts a finished game, and returns the record as it now stands. */
export function recordGame(won: boolean): LiarsDiceRecord {
  const previous = readRecord();
  const record = {
    wins: previous.wins + (won ? 1 : 0),
    games: previous.games + 1,
    run: won ? previous.run + 1 : 0,
  };
  writeStored(RECORD, JSON.stringify(record));
  return record;
}

/** The table picked last time, offered first; a first game's otherwise. */
export function readPicks(): SoloPicks {
  const stored = readJson(PICKS) as Partial<SoloPicks> | null;
  const bots = stored?.bots;
  const dice = stored?.dicePerPlayer;
  return {
    bots:
      Number.isInteger(bots) &&
      (bots as number) >= MIN_BOTS &&
      (bots as number) <= MAX_BOTS
        ? (bots as number)
        : FIRST_PICKS.bots,
    dicePerPlayer: isDicePerPlayer(dice)
      ? (dice as DicePerPlayer)
      : FIRST_PICKS.dicePerPlayer,
  };
}

export function writePicks(picks: SoloPicks): void {
  writeStored(PICKS, JSON.stringify(picks));
}
