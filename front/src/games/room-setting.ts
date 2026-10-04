import type { AnyLobbyRoomInfo } from '../../../shared/wire-types';
import { boardName } from '../minesweeper/boards';
import { plural } from './plural';

/** The setting a room was made with: "2 rounds", "Small 9 × 9". */
export function roomSetting(room: AnyLobbyRoomInfo): string {
  return room.gameType === 'draw-and-guess'
    ? plural(room.rounds, 'round')
    : boardName(room.difficulty);
}
