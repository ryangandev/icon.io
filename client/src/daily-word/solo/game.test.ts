import { describe, expect, it } from 'vitest';
import {
  deleteLetter,
  guessesToWin,
  isOver,
  isWon,
  newGame,
  rowsOf,
  submit,
  typeLetter,
  type SoloGame,
} from './game';

const type = (game: SoloGame, word: string) =>
  [...word].reduce(typeLetter, game);

const guess = (game: SoloGame, word: string) => submit(type(game, word));

describe('a word on your own', () => {
  it('types up to five letters, in lowercase, and deletes them', () => {
    let game = type(newGame('plant'), 'StAreS');
    expect(game.typed).toBe('stare');
    game = deleteLetter(game);
    expect(game.typed).toBe('star');
    expect(typeLetter(game, '1').typed).toBe('star');
  });

  it('marks a guess and clears the row', () => {
    const game = guess(newGame('plant'), 'stare');
    expect(game.typed).toBe('');
    expect(rowsOf(game)).toEqual([
      {
        word: 'stare',
        marks: ['absent', 'present', 'correct', 'absent', 'absent'],
      },
    ]);
  });

  it('turns back a row that cannot be used, keeping it as typed', () => {
    const short = submit(type(newGame('plant'), 'sta'));
    expect(short).toMatchObject({ problem: 'tooShort', typed: 'sta' });
    expect(short.guesses).toEqual([]);

    const notAWord = submit(type(newGame('plant'), 'blant'));
    expect(notAWord).toMatchObject({ problem: 'notAWord', typed: 'blant' });

    const repeat = guess(guess(newGame('plant'), 'stare'), 'stare');
    expect(repeat).toMatchObject({ problem: 'alreadyGuessed' });
    expect(repeat.guesses).toEqual(['stare']);

    // Typing again clears the note.
    expect(deleteLetter(notAWord).problem).toBeNull();
  });

  it('is won by the word, and over after six misses', () => {
    let game = newGame('plant');
    for (const word of ['stare', 'cloud', 'giant', 'plant']) {
      game = guess(game, word);
    }
    expect(isWon(game)).toBe(true);
    expect(guessesToWin(game)).toBe(4);
    expect(typeLetter(game, 'a')).toBe(game);

    let missed = newGame('watch');
    for (const word of ['hatch', 'match', 'latch', 'batch', 'patch', 'catch']) {
      missed = guess(missed, word);
    }
    expect(isOver(missed)).toBe(true);
    expect(guessesToWin(missed)).toBeNull();
  });
});
