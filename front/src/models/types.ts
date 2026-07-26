type RoomStatus = 'Open' | 'Full' | 'In Progress';

interface PlayerInfo {
  username: string;
  points: number;
  receivedPointsThisTurn: boolean;
  /** False while the player is disconnected but still holding their seat. */
  isConnected: boolean;
}

interface OwnerInfo {
  username: string;
  playerId: string;
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
  // The server never sends the password itself — only whether one is set.
  hasPassword: boolean;
}

/**
 * Keyed by player id, not socket id. A socket id changes on every reload; a
 * player id is issued by the server and survives one, which is what lets a
 * seat and a score outlive a refresh.
 */
interface DrawAndGuessDetailRoomInfo extends RoomInfo {
  playerList: Record<string, PlayerInfo>;
  currentDrawer: string; // current drawer's player id
  currentWord: string;
  currentWordHint: string;
  currentRound: number;
  isGameStarted: boolean;
  isWordSelectingPhase: boolean;
  isDrawingPhase: boolean;
  isReviewingPhase: boolean;
  drawerQueue: string[]; // player ids still to draw this round
  wordCategory: string;
  wordChoices: string[];
  // How long the server says is left in the current phase, at the moment it
  // sent this snapshot. 0 when no phase is running.
  phaseEndsInMs: number;
}

export type {
  RoomStatus,
  PlayerInfo,
  OwnerInfo,
  RoomCreateRequestBody,
  RoomInfo,
  DrawAndGuessDetailRoomInfo,
};
