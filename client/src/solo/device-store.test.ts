import { beforeEach, describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { zh } from '../i18n/zh';
import {
  dayLabel,
  dayOf,
  readDayBests,
  recordDayBest,
  writeStored,
} from './device-store';

const at = (day: string, hour = 12) => new Date(`${day}T${hour}:00:00`);

beforeEach(() => {
  localStorage.clear();
});

describe('the best of each day', () => {
  it('keeps a day’s best, and only a better one', () => {
    expect(recordDayBest('k', 200, at('2026-10-04'))).toEqual({
      isDayBest: true,
    });
    expect(recordDayBest('k', 250, at('2026-10-04', 18))).toEqual({
      isDayBest: false,
    });
    expect(recordDayBest('k', 150, at('2026-10-04', 20))).toEqual({
      isDayBest: true,
    });
    expect(readDayBests('k')).toEqual([{ day: '2026-10-04', result: 150 }]);
  });

  it('lists the latest day first, and keeps a week of them', () => {
    for (let date = 1; date <= 9; date++) {
      recordDayBest('k', 100 + date, at(`2026-10-0${date}`));
    }
    const days = readDayBests('k');
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ day: '2026-10-09', result: 109 });
    expect(days.at(-1)!.day).toBe('2026-10-03');
  });

  it('shrugs off a stored value it cannot read', () => {
    writeStored('days:k', 'not json');
    expect(readDayBests('k')).toEqual([]);
    writeStored('days:k', JSON.stringify([{ day: '2026-10-04' }, 7]));
    expect(readDayBests('k')).toEqual([]);
  });

  it('names a day by how long ago it was', () => {
    const now = at('2026-10-04');
    expect(dayOf(now)).toBe('2026-10-04');
    expect(dayLabel('2026-10-04', now, en)).toBe('Today');
    expect(dayLabel('2026-10-03', now, en)).toBe('Yesterday');
    expect(dayLabel('2026-10-01', now, en)).toBe('Oct 1');
    // Across a month.
    expect(dayLabel('2026-09-30', at('2026-10-01'), en)).toBe('Yesterday');
  });

  it('names kept days in the player’s Chinese locale', () => {
    const now = at('2026-10-04');
    expect(dayLabel('2026-10-04', now, zh)).toBe('今天');
    expect(dayLabel('2026-10-03', now, zh)).toBe('昨天');
    expect(dayLabel('2026-10-01', now, zh)).toBe('10 月 1 日');
  });
});
