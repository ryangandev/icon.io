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

const sortPlayerListByPoints = (
    playerList: Record<string, PlayerInfo>,
): Array<[string, PlayerInfo]> => {
    return Object.entries(playerList).sort((a, b) => b[1].points - a[1].points);
};

export {
    formatTimeInMinutesAndSeconds,
    statusColors,
    sortPlayerListByPoints,
};
