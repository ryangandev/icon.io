import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { zh } from '../i18n/zh';
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
  it('explains the broken feature in Chinese', () => {
    expect(
      whyNotATrio(
        [
          card({ fill: 'striped' }),
          card({ fill: 'striped', colour: 'blue' }),
          card({ colour: 'ink' }),
        ],
        zh,
      ),
    ).toBe('其中 2 张是条纹，另 1 张是实心。');
    expect(
      whyNotATrio(
        [
          card({ count: 3 }),
          card({ count: 3, colour: 'blue' }),
          card({ count: 2, colour: 'ink' }),
        ],
        zh,
      ),
    ).toBe('其中 2 张有 3 个图形，另 1 张有 2 个。');
  });

  it('names the first feature two of them share and the third does not', () => {
    expect(
      whyNotATrio(
        [
          card({ fill: 'striped' }),
          card({ fill: 'striped', colour: 'blue' }),
          card({ colour: 'ink' }),
        ],
        en,
      ),
    ).toBe('Two are striped and one is solid.');
    expect(
      whyNotATrio(
        [
          card({}),
          card({ colour: 'blue', fill: 'outline' }),
          card({ colour: 'blue' }),
        ],
        en,
      ),
    ).toBe('Two are blue and one is coral.');
    expect(
      whyNotATrio(
        [
          card({}),
          card({ colour: 'blue' }),
          card({ colour: 'ink', shape: 'triangle' }),
        ],
        en,
      ),
    ).toBe('Two are circles and one is a triangle.');
    expect(
      whyNotATrio(
        [
          card({ count: 3 }),
          card({ count: 3, colour: 'blue' }),
          card({ count: 2, colour: 'ink' }),
        ],
        en,
      ),
    ).toBe('Two have three shapes and one has two.');
    expect(
      whyNotATrio(
        [
          card({ fill: 'outline' }),
          card({ fill: 'outline', colour: 'blue' }),
          card({ colour: 'ink' }),
        ],
        en,
      ),
    ).toBe('Two are outlined and one is solid.');
  });

  it('has nothing to say about a trio', () => {
    expect(
      whyNotATrio(
        [card({}), card({ colour: 'blue' }), card({ colour: 'ink' })],
        en,
      ),
    ).toBeNull();
  });
});
