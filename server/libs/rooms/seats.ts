import type { RoomStatus } from '../../../shared/wire-types.js';
import type { Room } from './types.js';

/*
 * What a room's seats add up to. Worked out whenever it is asked for rather
 * than kept on the room, so that nothing has to remember to update it after a
 * seat is taken or given up, or a game starts or ends, and it cannot go stale.
 */

/** Seats taken, by players here or away. */
const seatCount = (room: Room): number => Object.keys(room.playerList).length;

/** What the lobby says of a room: playing, full, or open to join. */
const roomStatus = (room: Room): RoomStatus => {
  if (room.isGameStarted) return 'In Progress';
  return seatCount(room) >= room.maxPlayers ? 'Full' : 'Open';
};

export { seatCount, roomStatus };
