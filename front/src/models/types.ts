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
    rounds: number;
    maxPlayers: number;
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
    wordCategory: string;
    wordChoices: string[];
}

export type {
    RoomStatus,
    PlayerInfo,
    OwnerInfo,
    RoomCreateRequestBody,
    RoomInfo,
    DrawAndGuessDetailRoomInfo,
};
