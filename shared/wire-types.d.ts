/**
 * The contract between the two halves: every shape that crosses the socket,
 * defined once.
 *
 * `front/src/models/types.ts` and `back/models/types.ts` used to hold
 * near-identical copies of all of this, edited in lockstep — and by the time
 * this was extracted they had already stopped matching. The client declared
 * `currentWord` as a required string where the server omits it while a word is
 * in play, typed `wordCategory` as a plain string where the server has a union,
 * and its `ErrorType` was missing a member the server had been sending for a
 * pass and a half. None of that was caught, because nothing compared the two.
 *
 * Now the client's idea of a payload *is* the server's definition of it, and a
 * field added to one side without the other stops the build.
 *
 * A declaration file rather than a module, because these are types and only
 * types. Both packages import them with `import type`, which erases at compile
 * time, so nothing is resolved at runtime, no bundler alias is needed, and the
 * backend's build output keeps its shape — a `.ts` here would land outside
 * `rootDir` and break `tsc -p tsconfig.build.json`. The cost is that a shared
 * *value* — an event-name constant, say — cannot live here. If one ever needs
 * to, this becomes a real package.
 */

type RoomStatus = 'Open' | 'Full' | 'In Progress';

/** The word bank's categories. `back/libs/word-bank.ts` is keyed by these. */
type WordCategory =
  | 'Fruits'
  | 'Animals'
  | 'League Of Legends'
  | 'Electronics'
  | 'Sports'
  | 'Food';

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

interface Coordinate {
  x: number;
  y: number;
}

/** One continuous line, from mouse-down to mouse-up. */
interface CanvasStroke {
  color: string;
  size: number;
  points: Coordinate[];
}

/**
 * The room summary shown in the lobby. Broadcast to every connected client, so
 * it carries `hasPassword` rather than the password itself.
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

/** The full snapshot sent to the players inside a room. */
interface DrawAndGuessRoomState extends LobbyRoomInfo {
  playerList: Record<string, PlayerInfo>;
  /** The current drawer's player id, not their name. */
  currentDrawer: string;
  currentWordHint: string;
  currentRound: number;
  isGameStarted: boolean;
  isWordSelectingPhase: boolean;
  isDrawingPhase: boolean;
  isReviewingPhase: boolean;
  drawerQueue: string[]; // a Set does not survive JSON serialization
  wordCategory: WordCategory | ''; // '' when no game is in progress
  // Time left in the current phase, relative rather than absolute so that a
  // client whose clock disagrees with the server's still counts down right.
  phaseEndsInMs: number;
  // Drawer-private while the word is in play; omitted rather than blanked so
  // that merging this snapshot never clobbers the drawer's own copy.
  currentWord?: string;
  wordChoices?: string[];
}

type ErrorType =
  | 'roomNotExist'
  | 'roomNotOpen'
  | 'incorrectPassword'
  | 'notEnoughPlayers'
  | 'gameAlreadyStarted'
  | 'notRoomOwner'
  // Not an error the UI shows: it is how the room page learns it arrived
  // without a seat, and its cue to ask for one.
  | 'notRoomMember';

/** What a `roomError` event actually carries. */
interface RoomErrorPayload {
  status: boolean;
  message: string;
  errorType: ErrorType;
}

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
  ErrorType,
  RoomErrorPayload,
};
