import { randomUUID } from 'node:crypto';
import type {
    DrawAndGuessDetailRoomInfo,
    DrawAndGuessRoomState,
    LobbyRoomInfo,
    PlayerInfo,
    RoomStatus,
} from '../models/types.js';
import type { WordBank, WordCategory } from './word-bank.js';

const generateRoomId = (): string => {
    return randomUUID();
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

/**
 * Builds the room summary shown in the lobby. This payload is broadcast to
 * every connected client, so it carries `hasPassword` rather than the password
 * itself — the frontend only ever used the field as a boolean to pick a lock
 * icon, while the raw value was readable by anyone who opened the lobby.
 */
const getDrawAndGuessLobbyRoomInfo = (
    drawAndGuessDetailRoomInfo: DrawAndGuessDetailRoomInfo,
): LobbyRoomInfo => {
    return {
        roomId: drawAndGuessDetailRoomInfo.roomId,
        roomName: drawAndGuessDetailRoomInfo.roomName,
        owner: drawAndGuessDetailRoomInfo.owner,
        status: drawAndGuessDetailRoomInfo.status,
        currentPlayerCount: drawAndGuessDetailRoomInfo.currentPlayerCount,
        maxPlayers: drawAndGuessDetailRoomInfo.maxPlayers,
        rounds: drawAndGuessDetailRoomInfo.rounds,
        hasPassword: drawAndGuessDetailRoomInfo.password !== '',
    };
};

/**
 * Builds the full room snapshot broadcast to the players inside a room.
 * Emitting the internal room object directly leaked the password, and — during
 * the drawing phase — the very word everyone else is supposed to be guessing.
 *
 * `currentWord` and `wordChoices` are drawer-private while the word is in play,
 * so they are omitted from the broadcast rather than blanked: the client merges
 * this snapshot over its existing state, and an omitted key leaves the drawer's
 * own copy intact. Both are delivered to the drawer alone, by
 * `drawerReceiveWordChoices` and `drawingPhaseStartedForDrawer`, and revealed to
 * the whole room by `reviewingPhaseStarted`.
 */
const getDrawAndGuessRoomState = (
    room: DrawAndGuessDetailRoomInfo,
): DrawAndGuessRoomState => {
    const isWordInPlay = room.isWordSelectingPhase || room.isDrawingPhase;

    const roomState: DrawAndGuessRoomState = {
        ...getDrawAndGuessLobbyRoomInfo(room),
        playerList: room.playerList,
        currentDrawer: room.currentDrawer,
        currentWordHint: room.currentWordHint,
        currentRound: room.currentRound,
        isGameStarted: room.isGameStarted,
        isWordSelectingPhase: room.isWordSelectingPhase,
        isDrawingPhase: room.isDrawingPhase,
        isReviewingPhase: room.isReviewingPhase,
        drawerQueue: [...room.drawerQueue],
        wordCategory: room.wordCategory,
    };

    if (!isWordInPlay) {
        roomState.currentWord = room.currentWord;
        roomState.wordChoices = room.wordChoices;
    }

    return roomState;
};

const getRandomCategory = (
    wordBank: WordBank,
): { name: WordCategory; words: string[] } => {
    const categoryList = Object.keys(wordBank) as WordCategory[];
    const randomCategoryIndex = getRandomInt(0, categoryList.length);
    const name = categoryList[randomCategoryIndex]!;

    return { name, words: wordBank[name] };
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

const getRandomElementFromSet = (set: Set<string>): string | undefined => {
    if (set.size === 0) return undefined;

    const randomIndex = getRandomInt(0, set.size);
    return [...set][randomIndex];
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
    getDrawAndGuessRoomState,
    getRandomCategory,
    getRandomChoicesFromList,
    getRandomElementFromSet,
    convertStrToUnderscores,
    resetPoints,
    resetReceivedPointsThisTurn,
};
