import type { WordCategory } from '../libs/word-bank.js';

type RoomStatus = 'Open' | 'Full' | 'In Progress';

interface PlayerInfo {
  username: string;
  points: number;
  receivedPointsThisTurn: boolean;
  /**
   * False while the player is disconnected but still holding their seat. The
   * room keeps them for a grace period so that a refresh — which takes about a
   * second — does not cost them their score or their place in the round.
   */
  isConnected: boolean;
}

interface OwnerInfo {
  username: string;
  playerId: string;
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

/**
 * Everything below is keyed by player id rather than socket id. A socket id
 * changes on every reload; a player id does not, which is what lets a seat, a
 * score and a turn survive a refresh. See `libs/player-session.ts`.
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
  drawerQueue: Set<string>; // player ids still to draw this round
  wordCategory: WordCategory | ''; // '' when no game is in progress
  wordChoices: string[];
  phaseEndsAt: number; // epoch ms the current phase ends; 0 when idle
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
  // Time left in the current phase, relative rather than absolute so that a
  // client whose clock disagrees with the server's still counts down right.
  phaseEndsInMs: number;
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
