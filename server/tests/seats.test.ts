import { describe, expect, it } from 'vitest';
import { roomStatus, seatCount } from '../libs/rooms/seats.js';
import type { Room } from '../libs/rooms/types.js';

/** A room with this many seats taken; nothing else about it matters here. */
const roomOf = (taken: number, maxPlayers: number, isGameStarted: boolean) =>
  ({
    maxPlayers,
    isGameStarted,
    playerList: Object.fromEntries(
      Array.from({ length: taken }, (_, index) => [
        `p${index}`,
        { username: `P${index}`, points: 0, isConnected: index % 2 === 0 },
      ]),
    ),
  }) as unknown as Room;

describe('a room’s seats', () => {
  it('counts every seat taken, by players here or away', () => {
    expect(seatCount(roomOf(3, 4, false))).toBe(3);
  });

  it('reports a started game as in progress regardless of size', () => {
    expect(roomStatus(roomOf(2, 4, true))).toBe('In Progress');
    expect(roomStatus(roomOf(4, 4, true))).toBe('In Progress');
  });

  it('reports a room as full only at capacity', () => {
    expect(roomStatus(roomOf(3, 4, false))).toBe('Open');
    expect(roomStatus(roomOf(4, 4, false))).toBe('Full');
  });
});
