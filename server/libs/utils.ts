import { randomUUID } from 'node:crypto';
import type { PlayerInfo, Standing } from '../../shared/wire-types.js';

/**
 * Helpers that belong to no particular game.
 *
 * The word-bank and hint helpers that used to sit here moved to
 * `socket/draw-and-guess/words.ts`, and the two `getDrawAndGuess…` builders
 * became that module's `toLobbyInfo` and `toRoomState` - the wire snapshot is
 * a thing a game defines, not a thing a utility file happens to know how to
 * build.
 */

const generateRoomId = (): string => {
  return randomUUID();
};

const getRandomInt = (min: number, max: number) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
};

/**
 * Time left in a room's current phase. Sent to clients as a duration rather
 * than an absolute timestamp so that a client with a skewed clock still counts
 * down correctly - it anchors this against its own `Date.now()`.
 *
 * Takes the field rather than the room so that neither this file nor its test
 * has to know what a room is.
 */
const getRemainingPhaseMs = (room: { phaseEndsAt: number }): number => {
  return Math.max(0, room.phaseEndsAt - Date.now());
};

const getRandomElementFromSet = (set: Set<string>): string | undefined => {
  if (set.size === 0) return undefined;

  const randomIndex = getRandomInt(0, set.size);
  return [...set][randomIndex];
};

const resetPoints = (
  playerList: Record<string, PlayerInfo>,
): Record<string, PlayerInfo> => {
  return Object.fromEntries(
    Object.entries(playerList).map(([playerId, playerInfo]) => {
      return [playerId, { ...playerInfo, points: 0 }];
    }),
  );
};

/** "1 point", "6 pairs". */
const countOf = (count: number, unit: string): string =>
  `${count} ${count === 1 ? unit : `${unit}s`}`;

/**
 * The chat line a finished game ends on, from its standings, best first:
 * everyone who shares the top score shares the win. `unit` is what a game's
 * points are: points, or the pairs found in Pairs.
 */
const gameOverMessage = (
  standings: readonly Standing[],
  unit = 'point',
): string => {
  const top = standings[0];
  if (!top) return 'Game has ended!';
  const winners = standings
    .filter((standing) => standing.points === top.points)
    .map((standing) => standing.username);
  const score = countOf(top.points, unit);
  if (winners.length === 1) {
    return `Game over: ${top.username} wins with ${score}!`;
  }
  const names = `${winners.slice(0, -1).join(', ')} and ${winners.at(-1)}`;
  return `Game over: ${names} tie with ${score}!`;
};

export {
  gameOverMessage,
  generateRoomId,
  getRandomInt,
  getRemainingPhaseMs,
  getRandomElementFromSet,
  resetPoints,
};
