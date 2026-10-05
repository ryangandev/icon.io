import type { AnyLobbyRoomInfo } from '../../../shared/wire-types';
import { boardName } from '../minesweeper/boards';
import { boardName as pairsBoardName } from '../pairs/boards';
import { plural } from './plural';

/** The setting a room was made with: "2 rounds", "Small 9 × 9", "10 hands",
 * "Large 6 × 6", "3 words". */
export function roomSetting(room: AnyLobbyRoomInfo): string {
  switch (room.gameType) {
    case 'draw-and-guess':
      return plural(room.rounds, 'round');
    case 'minesweeper':
      return boardName(room.difficulty);
    case 'make-24':
      return plural(room.hands, 'hand');
    case 'pairs':
      return pairsBoardName(room.board);
    case 'daily-word':
      return plural(room.rounds, 'word');
  }
}
