import { describe, expect, it } from 'vitest';
import { cardOf, type CardFeatures } from '../../../shared/trios';
import { whyNotATrio } from './words';

const card = (features: Partial<CardFeatures>) =>
  cardOf({
    colour: 'coral',
    shape: 'circle',
    count: 1,
    fill: 'solid',
    ...features,
  });

describe('why three cards are not a trio', () => {
  it('names the first feature two of them share and the third does not', () => {
    expect(
      whyNotATrio([
        card({ fill: 'striped' }),
        card({ fill: 'striped', colour: 'blue' }),
        card({ colour: 'ink' }),
      ]),
    ).toBe('Two are striped and one is solid.');
    expect(
      whyNotATrio([
        card({}),
        card({ colour: 'blue', fill: 'outline' }),
        card({ colour: 'blue' }),
      ]),
    ).toBe('Two are blue and one is coral.');
    expect(
      whyNotATrio([
        card({}),
        card({ colour: 'blue' }),
        card({ colour: 'ink', shape: 'triangle' }),
      ]),
    ).toBe('Two are circles and one is a triangle.');
    expect(
      whyNotATrio([
        card({ count: 3 }),
        card({ count: 3, colour: 'blue' }),
        card({ count: 2, colour: 'ink' }),
      ]),
    ).toBe('Two have three shapes and one has two.');
    expect(
      whyNotATrio([
        card({ fill: 'outline' }),
        card({ fill: 'outline', colour: 'blue' }),
        card({ colour: 'ink' }),
      ]),
    ).toBe('Two are outlined and one is solid.');
  });

  it('has nothing to say about a trio', () => {
    expect(
      whyNotATrio([
        card({}),
        card({ colour: 'blue' }),
        card({ colour: 'ink' }),
      ]),
    ).toBeNull();
  });
});
