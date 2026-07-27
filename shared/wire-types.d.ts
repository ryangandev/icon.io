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
 * *value* cannot live here, which is why the event names below are a union of
 * string literals rather than a frozen object of constants: a type still makes
 * one side's typo fail the other side's build, and it costs no build config.
 */

/**
 * Which game a room is playing.
 *
 * Every room-layer payload carries this, because one lobby subscription, one
 * join and one departure now have to say which game they mean. It is also the
 * key the server's module registry is keyed by.
 */
type GameType = 'draw-and-guess' | 'minesweeper';

type RoomStatus = 'Open' | 'Full' | 'In Progress';

/** The word bank's categories. `back/libs/word-bank.ts` is keyed by these. */
type WordCategory =
  | 'Fruits'
  | 'Animals'
  | 'League Of Legends'
  | 'Electronics'
  | 'Sports'
  | 'Food';

/**
 * What every game knows about a player, and nothing more.
 *
 * `receivedPointsThisTurn` used to live here, which made the shared shape carry
 * a field that means nothing outside a Draw & Guess turn. Per-game facts about
 * a player belong to the game — Draw & Guess reports the same information as
 * `scoredThisTurn` on its own room state.
 */
interface PlayerInfo {
  username: string;
  points: number;
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

/**
 * The half of a create request every game shares. The other half — rounds,
 * board size — is `settings`, which only the game's own module can read.
 */
interface RoomCreateRequestBody {
  gameType: GameType;
  roomName: string;
  ownerUsername: string;
  maxPlayers: number;
  password: string;
  settings: unknown;
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
 * The room summary shown in a lobby. Broadcast to everyone subscribed to that
 * game's lobby, so it carries `hasPassword` rather than the password itself.
 *
 * Games extend this with whatever their lobby table needs a column for. A
 * stringly-typed `settings` blob would have saved the two interfaces below and
 * cost the lobby its types.
 */
interface LobbyRoomInfo {
  gameType: GameType;
  roomId: string;
  roomName: string;
  owner: OwnerInfo;
  status: RoomStatus;
  currentPlayerCount: number;
  maxPlayers: number;
  hasPassword: boolean;
}

/**
 * The full snapshot sent to the players inside a room — the generic half. Every
 * game has players, a start, and a clock; everything else is the game's own.
 */
interface RoomState extends LobbyRoomInfo {
  playerList: Record<string, PlayerInfo>;
  isGameStarted: boolean;
  /**
   * Time left in the current phase, relative rather than absolute so that a
   * client whose clock disagrees with the server's still counts down right.
   */
  phaseEndsInMs: number;
}

interface DrawAndGuessLobbyRoomInfo extends LobbyRoomInfo {
  gameType: 'draw-and-guess';
  rounds: number;
}

interface DrawAndGuessRoomState extends RoomState {
  gameType: 'draw-and-guess';
  rounds: number;
  /** The current drawer's player id, not their name. */
  currentDrawer: string;
  currentWordHint: string;
  currentRound: number;
  isWordSelectingPhase: boolean;
  isDrawingPhase: boolean;
  isReviewingPhase: boolean;
  drawerQueue: string[]; // a Set does not survive JSON serialization
  /** Player ids that have already scored this turn, and so cannot guess again. */
  scoredThisTurn: string[];
  wordCategory: WordCategory | ''; // '' when no game is in progress
  // Drawer-private while the word is in play; omitted rather than blanked so
  // that merging this snapshot never clobbers the drawer's own copy.
  currentWord?: string;
  wordChoices?: string[];
}

/** What a Draw & Guess room is created with. */
interface DrawAndGuessSettings {
  rounds: number;
}

type MinesweeperDifficulty = 'Small' | 'Medium' | 'Large';

/** What a Minesweeper room is created with. */
interface MinesweeperSettings {
  difficulty: MinesweeperDifficulty;
}

/**
 * One cell, as everybody is allowed to see it:
 *
 * - `-1` hidden
 * - `0`–`8` revealed, with that many mines among its eight neighbours
 * - `9` a mine somebody hit, now common knowledge
 *
 * A number per cell rather than an object, because the whole board goes out
 * every round and a 16×30 board is 480 of them.
 */
type MinesweeperCellView = number;

/** What one player's pick was worth, and what it risked. */
interface MinesweeperPickResult {
  playerId: string;
  username: string;
  /** Row-major index into the board. */
  index: number;
  /**
   * The cell's mine probability immediately before the round, computed from
   * public information alone — which is why it can be shown to everyone
   * afterwards without giving anything away.
   */
  risk: number;
  hitMine: boolean;
  points: number;
  /** How many players picked this same cell, including this one. */
  sharedWith: number;
  /** True when the clock ran out and the server picked the safest cell. */
  autoPlayed: boolean;
}

interface MinesweeperLobbyRoomInfo extends LobbyRoomInfo {
  gameType: 'minesweeper';
  difficulty: MinesweeperDifficulty;
}

interface MinesweeperRoomState extends RoomState {
  gameType: 'minesweeper';
  difficulty: MinesweeperDifficulty;
  width: number;
  height: number;
  totalMines: number;
  /** Row-major, `width * height` entries. Never the hidden layout. */
  board: MinesweeperCellView[];
  round: number;
  /** Player ids that have locked a pick in this round — never which cell. */
  lockedIn: string[];
  /** How many mines have been hit, so a client can show mines remaining. */
  minesFound: number;
  /** What the previous round resolved to; empty before the first one ends. */
  lastRound: MinesweeperPickResult[];
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

/** What a `room:error` event actually carries. */
interface RoomErrorPayload {
  status: boolean;
  message: string;
  errorType: ErrorType;
}

/**
 * Every event name, in one place.
 *
 * The old names spelled their game into themselves —
 * `clientJoinDrawAndGuessRoomRequest`, `updateDrawAndGuessLobbyRoomList` — so
 * adding a second game meant either a second near-identical set or a second
 * game answering to the first one's name. What is generic is now namespaced by
 * concern (`room:`, `lobby:`, `chat:`) and what belongs to a game is prefixed
 * with that game's short tag (`dg:`).
 *
 * These are types, not constants, for the reason at the top of this file. Both
 * halves route their emits and listeners through helpers typed on these unions,
 * so a name that exists on only one side does not compile on either.
 */
type ClientToServerEvent =
  // Identity, before anything else.
  | 'identifyPlayer'
  // The generic room layer.
  | 'lobby:subscribe'
  | 'lobby:unsubscribe'
  | 'room:create'
  | 'room:join'
  | 'room:leave'
  | 'room:sync'
  | 'game:start'
  | 'chat:send'
  // Draw & Guess.
  | 'dg:guess'
  | 'dg:select-word'
  | 'dg:draw:start'
  | 'dg:draw:move'
  | 'dg:draw:end'
  | 'dg:draw:undo'
  | 'dg:draw:clear'
  // Minesweeper.
  | 'ms:pick';

type ServerToClientEvent =
  | 'playerIdentity'
  // The generic room layer.
  | 'lobby:rooms'
  | 'room:created'
  | 'room:joined'
  | 'room:join:denied'
  | 'room:state'
  | 'room:error'
  | 'chat:message'
  // Draw & Guess.
  | 'dg:game:started'
  | 'dg:game:ended'
  | 'dg:round'
  | 'dg:phase:word-select'
  | 'dg:phase:drawing'
  | 'dg:phase:review'
  | 'dg:phase:idle'
  | 'dg:word-choices'
  | 'dg:word'
  | 'dg:hint'
  | 'dg:scores'
  | 'dg:guess:correct'
  | 'dg:canvas:sync'
  | 'dg:canvas:start'
  | 'dg:canvas:move'
  | 'dg:canvas:end'
  | 'dg:canvas:undo'
  | 'dg:canvas:clear'
  // Minesweeper.
  | 'ms:game:started'
  | 'ms:game:ended'
  | 'ms:round'
  | 'ms:locked'
  | 'ms:resolve';

export type {
  GameType,
  RoomStatus,
  WordCategory,
  PlayerInfo,
  OwnerInfo,
  RoomCreateRequestBody,
  Coordinate,
  CanvasStroke,
  LobbyRoomInfo,
  RoomState,
  DrawAndGuessLobbyRoomInfo,
  DrawAndGuessRoomState,
  DrawAndGuessSettings,
  MinesweeperDifficulty,
  MinesweeperSettings,
  MinesweeperCellView,
  MinesweeperPickResult,
  MinesweeperLobbyRoomInfo,
  MinesweeperRoomState,
  ErrorType,
  RoomErrorPayload,
  ClientToServerEvent,
  ServerToClientEvent,
};
