import type { PlayerInfo, RoomStatus } from '../models/types';

const formatTimeInMinutesAndSeconds = (timeInSeconds: number): string => {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = timeInSeconds % 60;
  return `${minutes < 10 ? '0' + minutes : minutes}:${
    seconds < 10 ? '0' + seconds : seconds
  }`;
};

const statusColors: Record<RoomStatus, string> = {
  Open: '#2ECC71',
  Full: '#E74C3C',
  'In Progress': '#F39C12',
};

/**
 * The player list, highest score first. `toSorted` rather than `sort`: this
 * runs during a render, and the array it is handed comes straight out of the
 * room state.
 */
const sortPlayerListByPoints = (
  playerList: Record<string, PlayerInfo>,
): Array<[string, PlayerInfo]> => {
  return Object.entries(playerList).toSorted(
    (a, b) => b[1].points - a[1].points,
  );
};

export { formatTimeInMinutesAndSeconds, statusColors, sortPlayerListByPoints };
