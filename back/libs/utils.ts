import { v4 as uuidv4 } from 'uuid';
import {
    DrawAndGuessDetailRoomInfo,
    PlayerInfo,
    RoomInfo,
    RoomStatus,
} from '../models/types.js';
import { WordBank } from './word-bank.js';

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
        return 'In Progress';
    }

    return currentSize === maxSize ? 'Full' : 'Open';
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

const getRandomCategory = (wordBank: WordBank): Record<string, string[]> => {
    const categoryList = Object.keys(wordBank);
    const randomCategoryIndex = getRandomInt(0, categoryList.length);
    const randomCategory = categoryList[randomCategoryIndex];

    return {
        [randomCategory]: wordBank[randomCategory],
    };
};

const getRandomChoicesFromList = (
    wordList: string[],
    numberOfChoices: number,
): string[] => {
    const selectedIndexes = new Set<number>();

    while (selectedIndexes.size < numberOfChoices) {
        selectedIndexes.add(getRandomInt(0, wordList.length));
    }

    return [...selectedIndexes].map((index) => wordList[index]);
};

const getRandomElementFromSet = (set: Set<string>): string => {
    const randomIndex = getRandomInt(0, set.size);
    const iterator = set.values();
    let result = iterator.next();

    for (let i = 0; i < randomIndex; i++) {
        result = iterator.next();
    }

    return result.value;
};

const convertStrToUnderscores = (str: string): string => {
    return str.replace(/\S/g, '_');
};

const resetPoints = (
    playerList: Record<string, PlayerInfo>,
): Record<string, PlayerInfo> => {
    return Object.fromEntries(
        Object.entries(playerList).map(([socketId, playerInfo]) => {
            return [
                socketId,
                {
                    ...playerInfo,
                    points: 0,
                },
            ];
        }),
    );
};

const resetReceivedPointsThisTurn = (
    playerList: Record<string, PlayerInfo>,
): Record<string, PlayerInfo> => {
    return Object.fromEntries(
        Object.entries(playerList).map(([socketId, playerInfo]) => {
            return [
                socketId,
                {
                    ...playerInfo,
                    receivedPointsThisTurn: false,
                },
            ];
        }),
    );
};

export {
    generateRoomId,
    getRandomInt,
    getRoomStatus,
    getDrawAndGuessLobbyRoomInfo,
    getRandomCategory,
    getRandomChoicesFromList,
    getRandomElementFromSet,
    convertStrToUnderscores,
    resetPoints,
    resetReceivedPointsThisTurn,
};
