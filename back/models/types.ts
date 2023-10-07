type RoomStatus = 'open' | 'full' | 'in progress';

interface PlayerInfo {
    username: string;
    score: number;
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
    owner: PlayerInfo;
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
    currentRound: number;
    isGameStarted: boolean;
    isGameEnded: boolean;
}

export type {
    RoomStatus,
    RoomCreateRequestBody,
    RoomInfo,
    PlayerInfo,
    DrawAndGuessDetailRoomInfo,
};
