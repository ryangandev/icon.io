import type { AnyRoomState, PlayerInfo } from '../../../shared/wire-types';

export interface Seat extends PlayerInfo {
  playerId: string;
}

/**
 * The room's players, highest score first; ties keep the order they sat down
 * in, which is the order the server lists them.
 */
export function rankedPlayers(state: AnyRoomState): Seat[] {
  return Object.entries(state.playerList)
    .map(([playerId, player]) => ({ playerId, ...player }))
    .toSorted((a, b) => b.points - a.points);
}

/** "1st", "2nd", "3rd", "4th"… */
export function ordinal(place: number): string {
  const tens = place % 100;
  if (tens >= 11 && tens <= 13) return `${place}th`;
  const suffix = ['th', 'st', 'nd', 'rd'][place % 10] ?? 'th';
  return `${place}${suffix}`;
}
