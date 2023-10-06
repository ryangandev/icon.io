type RoomStatus = 'open' | 'full' | 'in progress';

interface PlayerInfo {
    username: string;
    score: number;
}

interface CreateRoomRequestBody {
    roomName: string;
    ownerUsername: string;
    maxSize: number;
    isPrivate: boolean;
    password?: string; // Required if isPrivate is true
}

interface CreateDrawAndGuessRoomRequestBody extends CreateRoomRequestBody {
    maxRound: number;
}

interface RoomInfoBase {
    roomId: string;
    roomName: string;
    owner: PlayerInfo;
    status: RoomStatus;
    currentSize: number;
    maxSize: number;
    maxRound: number;
    isPrivate: boolean;
    password?: string; // Required if isPrivate is true
}

interface DrawAndGuessDetailRoomInfo extends RoomInfoBase {
    playerList: Record<string, PlayerInfo>;
    currentDrawer: string; // current drawer's socket id
    currentWord: string;
    currentRound: number;
    maxRound: number;
    isGameStarted: boolean;
    isGameEnded: boolean;
}

export type {
    RoomStatus,
    CreateRoomRequestBody,
    CreateDrawAndGuessRoomRequestBody,
    RoomInfoBase,
    PlayerInfo,
    DrawAndGuessDetailRoomInfo,
};
