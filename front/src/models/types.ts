type RoomStatus = 'open' | 'full' | 'in progress';

interface PlayerInfo {
    username: string;
    score: number;
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
    owner: PlayerInfo;
    status: RoomStatus;
    currentPlayerCount: number;
    maxPlayers: number;
    rounds: number;
    password: string;
}

export type { RoomStatus, PlayerInfo, RoomCreateRequestBody, RoomInfo };
