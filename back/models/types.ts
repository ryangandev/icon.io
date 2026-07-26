import type {
  CanvasStroke,
  OwnerInfo,
  PlayerInfo,
  RoomStatus,
  WordCategory,
} from '../../shared/wire-types.js';

/**
 * Server-private state.
 *
 * Everything a client can see is defined once, in `shared/wire-types.d.ts`, and
 * re-exported at the bottom of this file so that the rest of the backend can go
 * on importing its types from one place. What is left here is what never leaves
 * the process: the room password, the word while it is being guessed, and the
 * drawing in the mutable form the relay maintains it in.
 */

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
 * The room's drawing. `pointCount` is a running total so the size cap is an
 * O(1) check rather than a walk of the whole drawing on every point; the wire
 * only ever sees `strokes`.
 */
interface RoomCanvas {
  strokes: CanvasStroke[];
  pointCount: number;
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
  // Sent to arrivals on its own rather than with the room snapshot: a snapshot
  // goes out every time anyone joins or leaves, and the drawing is the largest
  // thing in the room.
  canvas: RoomCanvas;
}

/**
 * The wire contract. `getDrawAndGuessLobbyRoomInfo` and
 * `getDrawAndGuessRoomState` in `libs/utils.ts` are the only way the internal
 * types above become these, which is what keeps a password or a live word from
 * leaking by someone emitting a room object wholesale.
 */
export type {
  RoomStatus,
  WordCategory,
  PlayerInfo,
  OwnerInfo,
  RoomCreateRequestBody,
  Coordinate,
  CanvasStroke,
  LobbyRoomInfo,
  DrawAndGuessRoomState,
} from '../../shared/wire-types.js';

export type { RoomInfo, RoomCanvas, DrawAndGuessDetailRoomInfo };
