import type { PlayerIdentity } from '../../../shared/wire-types';

/*
 * Both live in sessionStorage: per tab, and surviving a reload, which is
 * exactly the lifetime of a seat at a table. localStorage would hand two tabs
 * one identity, and they would fight over one seat.
 */

const IDENTITY_KEY = 'zumpo:identity';
const NAME_KEY = 'zumpo:name';

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    // Storage can be blocked; the player is then simply new on every load.
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Nothing to do: the value still lives in memory for this page.
  }
}

export function readIdentity(): PlayerIdentity | null {
  try {
    const parsed = JSON.parse(read(IDENTITY_KEY) ?? 'null') as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'playerId' in parsed &&
      'token' in parsed &&
      typeof parsed.playerId === 'string' &&
      typeof parsed.token === 'string'
    ) {
      return { playerId: parsed.playerId, token: parsed.token };
    }
  } catch {
    // A malformed entry just means we identify as new.
  }
  return null;
}

export function writeIdentity({ playerId, token }: PlayerIdentity): void {
  write(IDENTITY_KEY, JSON.stringify({ playerId, token }));
}

export function readName(): string {
  return read(NAME_KEY) ?? '';
}

export function writeName(name: string): void {
  write(NAME_KEY, name);
}
