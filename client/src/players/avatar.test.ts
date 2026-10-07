import { describe, expect, it } from 'vitest';
import { initialsOf } from './avatar';

describe('avatar initials', () => {
  it('takes one initial from each of the first two words', () => {
    expect(initialsOf('  sleepy   otter turtle  ')).toBe('SO');
    expect(initialsOf('小明 Chen')).toBe('小C');
  });

  it('uses up to two graphemes for a name without spaces', () => {
    expect(initialsOf('活泼水獭')).toBe('活泼');
    expect(initialsOf('李')).toBe('李');
    expect(initialsOf('小A明')).toBe('小A');
    expect(initialsOf('a')).toBe('A');
    expect(initialsOf('   ')).toBe('');
  });

  it('keeps combining marks and joined emoji whole', () => {
    expect(initialsOf('e\u0301lodie')).toBe('E\u0301L');
    expect(initialsOf('👩🏽‍💻水獭')).toBe('👩🏽‍💻水');
    expect(initialsOf('👨‍👩‍👧‍👦')).toBe('👨‍👩‍👧‍👦');
    expect(initialsOf('🇨🇳 otter')).toBe('🇨🇳O');
  });
});
