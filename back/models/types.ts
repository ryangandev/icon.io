import type { WordCategory } from '../libs/word-bank.js';

type RoomStatus = 'Open' | 'Full' | 'In Progress';

interface PlayerInfo {
    username: string;
    points: number;
    receivedPointsThisTurn: boolean;
}

interface OwnerInfo {
    username: string;
    socketId: string;
}

interface RoomCreateRequestBody {
    roomName: string;
    ownerUsername: string;
    maxPlayers: number;
    rounds: number;
    password: string;
}

interface RoomInfo {
    roomId: string;
    roomName: string;
    owner: OwnerInfo;
    status: RoomStatus;
    currentPlayerCount: number;
    maxPlayers: number;
    rounds: number;
    password: string;
}

interface DrawAndGuessDetailRoomInfo extends RoomInfo {
    playerList: Record<string, PlayerInfo>;
    currentDrawer: string; // current drawer's socket id
    currentWord: string;
    currentWordHint: string;
    currentRound: number;
    isGameStarted: boolean;
    isWordSelectingPhase: boolean;
    isDrawingPhase: boolean;
    isReviewingPhase: boolean;
    drawerQueue: Set<string>; // queue of socket ids
    wordCategory: WordCategory | ''; // '' when no game is in progress
    wordChoices: string[];
}

/**
 * The types above are the server's private state. The two below are the only
 * shapes that may be sent to a client — anything emitted to a socket has to go
 * through `getDrawAndGuessLobbyRoomInfo` or `getDrawAndGuessRoomState` so that
 * secrets (`password`, and the word while it is still being guessed) cannot
 * leak by accidentally emitting an internal object wholesale.
 */

interface LobbyRoomInfo {
    roomId: string;
    roomName: string;
    owner: OwnerInfo;
    status: RoomStatus;
    currentPlayerCount: number;
    maxPlayers: number;
    rounds: number;
    hasPassword: boolean;
}

interface DrawAndGuessRoomState extends LobbyRoomInfo {
    playerList: Record<string, PlayerInfo>;
    currentDrawer: string;
    currentWordHint: string;
    currentRound: number;
    isGameStarted: boolean;
    isWordSelectingPhase: boolean;
    isDrawingPhase: boolean;
    isReviewingPhase: boolean;
    drawerQueue: string[]; // a Set does not survive JSON serialization
    wordCategory: WordCategory | '';
    // Drawer-private while the word is in play; omitted rather than blanked so
    // that merging this snapshot never clobbers the drawer's own copy.
    currentWord?: string;
    wordChoices?: string[];
}

export type {
    RoomStatus,
    PlayerInfo,
    OwnerInfo,
    RoomCreateRequestBody,
    RoomInfo,
    DrawAndGuessDetailRoomInfo,
    LobbyRoomInfo,
    DrawAndGuessRoomState,
};
