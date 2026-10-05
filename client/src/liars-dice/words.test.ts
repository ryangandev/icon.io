import { describe, expect, it } from 'vitest';
import type { LiarsDiceReveal } from '../../../shared/wire-types';
import { countDetail, naming, revealBar, verdict } from './words';

const NAMES: Record<string, string> = { leo: 'Leo', sam: 'Sam', maya: 'Maya' };
const asSam = naming('sam', (id) => NAMES[id]);
const asMaya = naming('maya', (id) => NAMES[id]);
const asLeo = naming('leo', (id) => NAMES[id]);

// LD10: Sam called Liar on Leo's five 5s; there were five, two of them wild.
const ld10: LiarsDiceReveal = {
  bid: { playerId: 'leo', count: 5, face: 5 },
  callerId: 'sam',
  matched: 5,
  wild: 2,
  loserId: 'sam',
  out: false,
};

describe('the words of a reveal', () => {
  it('counts at a glance', () => {
    expect(countDetail(ld10)).toBe('incl. 2 wild ones · bid was five');
    expect(countDetail({ ...ld10, wild: 1 })).toBe(
      'incl. 1 wild one · bid was five',
    );
    expect(countDetail({ ...ld10, wild: 0 })).toBe(
      'no wild ones · bid was five',
    );
  });

  it('says who was right, to you and to everybody else', () => {
    expect(verdict(ld10, asMaya)).toBe('Leo’s bid stands');
    expect(verdict(ld10, asLeo)).toBe('Your bid stands');
    expect(revealBar(ld10, asSam)).toEqual({
      label: 'You called Liar',
      main: 'Leo’s bid stands',
      meta: 'You lose a die',
    });
    expect(revealBar(ld10, asMaya)).toEqual({
      label: 'Sam called Liar',
      main: 'Leo’s bid stands',
      meta: 'Sam loses a die',
    });
  });

  it('calls a lie a lie', () => {
    // LD12: Maya called Sam's two 6s; there was one, and Sam was out.
    const ld12: LiarsDiceReveal = {
      bid: { playerId: 'sam', count: 2, face: 6 },
      callerId: 'maya',
      matched: 1,
      wild: 0,
      loserId: 'sam',
      out: true,
    };
    expect(verdict(ld12, asMaya)).toBe('a lie, so Sam is out');
    expect(verdict(ld12, asSam)).toBe('a lie, so you are out');
    expect(revealBar(ld12, asSam)).toMatchObject({
      main: 'Your bid was a lie',
      meta: 'You are out',
    });
  });
});
