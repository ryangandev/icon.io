import { describe, expect, it } from 'vitest';
import { NAME_MAX_LENGTH } from '../ui';
import { NAME_WORDS, randomName } from './random-name';

describe('a random name', () => {
  it('fits the limit whichever two words it gets', () => {
    const longest =
      Math.max(...NAME_WORDS.adjectives.map((word) => word.length)) +
      1 +
      Math.max(...NAME_WORDS.animals.map((word) => word.length));
    expect(longest).toBeLessThanOrEqual(NAME_MAX_LENGTH);
  });

  it('is an adjective and an animal', () => {
    const [adjective, animal] = randomName().split(' ');
    expect(NAME_WORDS.adjectives).toContain(adjective);
    expect(NAME_WORDS.animals).toContain(animal);
  });

  it('never repeats the name it replaces', () => {
    // The first pair drawn is the one being replaced; the next is not.
    const draws = [0, 0, 0.5, 0.5];
    const random = () => draws.shift() ?? 0.9;
    const first = `${NAME_WORDS.adjectives[0]} ${NAME_WORDS.animals[0]}`;
    expect(randomName(first, random)).not.toBe(first);
  });
});
