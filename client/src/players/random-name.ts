/*
 * The name a visitor starts with, so nothing stands between them and a game:
 * a friendly adjective and an animal, like Sleepy Otter. Every pair fits the
 * server's 18 characters, and the two words give the avatar two initials.
 */

const ADJECTIVES = [
  'Brave',
  'Breezy',
  'Bubbly',
  'Bouncy',
  'Calm',
  'Cheery',
  'Clever',
  'Comfy',
  'Cosmic',
  'Curious',
  'Dapper',
  'Dizzy',
  'Dreamy',
  'Fancy',
  'Fizzy',
  'Fluffy',
  'Gentle',
  'Giddy',
  'Golden',
  'Happy',
  'Jolly',
  'Lucky',
  'Mellow',
  'Merry',
  'Mighty',
  'Nimble',
  'Peppy',
  'Plucky',
  'Quiet',
  'Quirky',
  'Rosy',
  'Silly',
  'Sleepy',
  'Snappy',
  'Sparkly',
  'Speedy',
  'Sunny',
  'Swift',
  'Tiny',
  'Witty',
  'Zesty',
  'Zippy',
] as const;

const ANIMALS = [
  'Badger',
  'Beaver',
  'Bunny',
  'Capybara',
  'Crab',
  'Duck',
  'Ferret',
  'Finch',
  'Fox',
  'Frog',
  'Gecko',
  'Goose',
  'Hedgehog',
  'Heron',
  'Koala',
  'Lemur',
  'Llama',
  'Lynx',
  'Marmot',
  'Mole',
  'Moose',
  'Newt',
  'Octopus',
  'Otter',
  'Owl',
  'Panda',
  'Parrot',
  'Penguin',
  'Pigeon',
  'Puffin',
  'Quokka',
  'Raccoon',
  'Robin',
  'Seal',
  'Sloth',
  'Squid',
  'Tapir',
  'Toad',
  'Turtle',
  'Walrus',
  'Wombat',
  'Yak',
] as const;

/** Every word list's pairs, for the test that keeps them within the limit. */
export const NAME_WORDS = { adjectives: ADJECTIVES, animals: ANIMALS };

const pick = <T>(list: readonly T[], random: () => number): T =>
  list[Math.floor(random() * list.length) % list.length];

/**
 * A random name, never `unlike`, so rolling again always shows a new one.
 * `random` is there for tests.
 */
export function randomName(
  unlike?: string,
  random: () => number = Math.random,
): string {
  for (;;) {
    const name = `${pick(ADJECTIVES, random)} ${pick(ANIMALS, random)}`;
    if (name !== unlike) return name;
  }
}
