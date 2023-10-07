import { v4 as uuidv4 } from 'uuid';
import {
    DrawAndGuessDetailRoomInfo,
    RoomInfo,
    RoomStatus,
} from '../models/types.js';

const generateRoomId = (): string => {
    return uuidv4();
};

const getRandomInt = (min: number, max: number) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
};

const getRoomStatus = (
    currentSize: number,
    maxSize: number,
    isStarted: boolean = false,
): RoomStatus => {
    if (isStarted) {
        return 'in progress';
    }

    return currentSize === maxSize ? 'full' : 'open';
};

const getDrawAndGuessLobbyRoomInfo = (
    drawAndGuessDetailRoomInfo: DrawAndGuessDetailRoomInfo,
): RoomInfo => {
    return {
        roomId: drawAndGuessDetailRoomInfo.roomId,
        roomName: drawAndGuessDetailRoomInfo.roomName,
        owner: drawAndGuessDetailRoomInfo.owner,
        status: drawAndGuessDetailRoomInfo.status,
        currentPlayerCount: drawAndGuessDetailRoomInfo.currentPlayerCount,
        maxPlayers: drawAndGuessDetailRoomInfo.maxPlayers,
        rounds: drawAndGuessDetailRoomInfo.rounds,
        password: drawAndGuessDetailRoomInfo.password,
    };
};

export {
    generateRoomId,
    getRandomInt,
    getRoomStatus,
    getDrawAndGuessLobbyRoomInfo,
};
