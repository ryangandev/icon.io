import type { AnyRoomState, PlayerInfo } from '../../../shared/wire-types';
import type { Messages } from '../i18n';

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

/**
 * Each standing's place, best first: a shared score shares a place, and the
 * next one skips past it (1, 1, 3).
 */
export function placesOf(standings: readonly { points: number }[]): number[] {
  return standings.map(
    ({ points }) => standings.findIndex((s) => s.points === points) + 1,
  );
}

/** "Ryan", "Ryan and Maya", "Ryan, Maya and Sam". */
export function listNames(names: readonly string[], m: Messages): string {
  return m.room.listNames(names);
}

/** "1st", "2nd", "3rd", "4th"… */
export function ordinal(place: number, m: Messages): string {
  return m.room.ordinal(place);
}
