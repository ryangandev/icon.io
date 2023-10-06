import { v4 as uuidv4 } from 'uuid';
import {
    DrawAndGuessDetailRoomInfo,
    RoomInfoBase,
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
): RoomInfoBase => {
    return {
        roomId: drawAndGuessDetailRoomInfo.roomId,
        roomName: drawAndGuessDetailRoomInfo.roomName,
        owner: drawAndGuessDetailRoomInfo.owner,
        status: drawAndGuessDetailRoomInfo.status,
        currentSize: drawAndGuessDetailRoomInfo.currentSize,
        maxSize: drawAndGuessDetailRoomInfo.maxSize,
        maxRound: drawAndGuessDetailRoomInfo.maxRound,
        isPrivate: drawAndGuessDetailRoomInfo.isPrivate,
    };
};

export {
    generateRoomId,
    getRandomInt,
    getRoomStatus,
    getDrawAndGuessLobbyRoomInfo,
};
