import {
  brokenFeature,
  cardFeatures,
  type CardFeatures,
  type Feature,
} from '../../../shared/trios';

const COUNT_WORDS = ['one', 'two', 'three'] as const;

const shapes = (count: number) => (count === 1 ? 'shape' : 'shapes');

/** A feature's value in words that follow "Two are" or "one is". */
function valueWords(feature: Feature, features: CardFeatures, many: boolean) {
  switch (feature) {
    case 'colour':
      return features.colour;
    case 'shape':
      return many ? `${features.shape}s` : `a ${features.shape}`;
    case 'fill':
      return features.fill === 'outline' ? 'outlined' : features.fill;
    case 'count':
      return COUNT_WORDS[features.count - 1];
  }
}

/**
 * Why three cards are not a trio, by the first feature that breaks it:
 * "Two are striped and one is solid." Null when they are one.
 */
export function whyNotATrio(cards: readonly number[]): string | null {
  const [a, b, c] = cards;
  const feature = brokenFeature(a, b, c);
  if (feature === null) return null;
  const features = cards.map(cardFeatures);
  const valueOf = (f: CardFeatures) => f[feature];
  // Exactly two share the feature's value; the odd one out is the other.
  const odd = features.find(
    (f) => features.filter((g) => valueOf(g) === valueOf(f)).length === 1,
  )!;
  const pair = features.find((f) => f !== odd)!;
  if (feature === 'count') {
    return `Two have ${valueWords(feature, pair, true)} ${shapes(pair.count)} and one has ${valueWords(feature, odd, false)}.`;
  }
  return `Two are ${valueWords(feature, pair, true)} and one is ${valueWords(feature, odd, false)}.`;
}
