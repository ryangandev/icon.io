import { describe, expect, it } from 'vitest';
import { dashedSides } from './pick-marker';

const DASH = 4;
const PERIOD = 7;

describe('dashedSides', () => {
  it.each([
    [44, 3, 6.5],
    [36, 3, 6.5],
    [26, 2, 5],
  ])(
    'centres a dash on every side of a %i px cell, as Figma does',
    (size, stroke, radius) => {
      const sides = dashedSides(size, size, stroke, radius);
      expect(sides).toHaveLength(4);
      const straight = size - stroke - 2 * radius;
      const length = straight + (Math.PI * radius) / 2;
      for (const { offset } of sides) {
        // Where the pattern is at the side's midpoint, measured from a dash's start.
        const phase = (((length / 2 + offset) % PERIOD) + PERIOD) % PERIOD;
        expect(phase).toBeCloseTo(DASH / 2);
      }
    },
  );

  it('joins the sides at the middle of each corner', () => {
    const sides = dashedSides(44, 44, 3, 6.5);
    const ends = sides.map(({ d }) => d.match(/[\d.]+ [\d.]+$/)?.[0]);
    const starts = sides.map(({ d }) => d.match(/^M ([\d.]+ [\d.]+)/)?.[1]);
    expect(starts.slice(1).concat(starts[0])).toEqual(ends);
  });
});
