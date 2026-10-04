/**
 * The contract between the two halves: every event that crosses the socket,
 * with its payload, defined once.
 *
 * Both sides type their Socket.IO objects on the two event maps at the bottom,
 * so an event renamed or reshaped on one side stops the other side's build
 * rather than silently never arriving. The server still validates everything
 * it receives with zod: a type says what a well-behaved client sends, not what
 * arrives.
 *
 * A declaration file rather than a module, because these are types and only
 * types. Both packages import them with `import type`, which erases at compile
 * time, so nothing is resolved at runtime and the backend's build output keeps
 * its shape.
 *
 * The protocol is snapshot-driven. Whenever anything in a room changes, every
 * seated player is sent `room:state`: the whole room as that player may see it.
 * A client renders the latest snapshot and keeps no game state of its own, so
 * a refresh, a reconnect or a missed event can never leave it out of step.
 * Only two things travel as increments, because they are streams: the drawing
 * (`dg:canvas:*`) and the chat.
 */

/**
 * Which game a room is playing. Every room-layer payload carries it, and it is
 * the key the server's module registry is keyed by.
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

/** What every game knows about a player, and nothing more. */
interface PlayerInfo {
  username: string;
  points: number;
  /**
   * False while the player is disconnected but still holding their seat. The
   * room keeps them for a grace period so that a refresh does not cost them
   * their score or their place in the round.
   */
  isConnected: boolean;
}

interface OwnerInfo {
  username: string;
  playerId: string;
}

/** Who a connection is: a server-issued id, and the secret that proves it. */
interface PlayerIdentity {
  playerId: string;
  token: string;
}

/** The answer to `session:identify`. */
interface SessionInfo extends PlayerIdentity {
  /** How long a dropped connection keeps its seats, for the reconnecting notice. */
  reconnectGraceMs: number;
}

// ---------------------------------------------------------------------------
// Requests and their answers

/**
 * Why a request was refused.
 *
 * `notRoomMember` is not an error the UI shows: it is how a room page learns
 * it arrived without a seat, and its cue to ask for one.
 */
type ErrorType =
  | 'roomNotExist'
  | 'roomNotOpen'
  | 'incorrectPassword'
  | 'notEnoughPlayers'
  | 'gameAlreadyStarted'
  | 'notRoomOwner'
  | 'notRoomMember'
  | 'invalidRequest';

interface RoomError {
  type: ErrorType;
  message: string;
}

/** What an acknowledged request answers: success with its value, or why not. */
type Result<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: RoomError };

/**
 * A new room. The creator takes the first seat and becomes its owner, so a
 * room never exists without somebody in it.
 */
interface RoomCreateRequest {
  gameType: GameType;
  roomName: string;
  username: string;
  maxPlayers: number;
  /** '' for an open room. */
  password: string;
  /** The game's own half, which only its module can read. */
  settings: DrawAndGuessSettings | MinesweeperSettings;
}

interface DrawAndGuessSettings {
  rounds: number;
}

type MinesweeperDifficulty = 'Small' | 'Medium' | 'Large';

interface MinesweeperSettings {
  difficulty: MinesweeperDifficulty;
}

// ---------------------------------------------------------------------------
// Lobbies

/**
 * The room summary shown in a lobby. Broadcast to everyone subscribed to that
 * game's lobby, so it carries `hasPassword` rather than the password itself.
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

interface DrawAndGuessLobbyRoomInfo extends LobbyRoomInfo {
  gameType: 'draw-and-guess';
  rounds: number;
}

interface MinesweeperLobbyRoomInfo extends LobbyRoomInfo {
  gameType: 'minesweeper';
  difficulty: MinesweeperDifficulty;
}

type AnyLobbyRoomInfo = DrawAndGuessLobbyRoomInfo | MinesweeperLobbyRoomInfo;

// ---------------------------------------------------------------------------
// Rooms

/**
 * The generic half of a room snapshot. Every game has players, a start, and a
 * clock; everything else is the game's own.
 */
interface RoomState extends LobbyRoomInfo {
  playerList: Record<string, PlayerInfo>;
  isGameStarted: boolean;
  /**
   * Time left in the current phase, relative rather than absolute so that a
   * client whose clock disagrees with the server's still counts down right.
   * 0 when nothing is running.
   */
  phaseEndsInMs: number;
}

/** One player's place when a game ended. */
interface Standing {
  playerId: string;
  username: string;
  points: number;
}

/**
 * How the last game in a room ended, kept until the next one starts so the
 * results stay on screen, and survive a refresh.
 */
interface GameSummary {
  /** True when too few players were left to carry on. */
  endedEarly: boolean;
  /** Highest score first. */
  standings: Standing[];
}

/** waiting: no game; choosing: the drawer picks a word; reveal: the word is shown. */
type DrawAndGuessPhase = 'waiting' | 'choosing' | 'drawing' | 'reveal';

interface DrawAndGuessGameSummary extends GameSummary {
  wordCategory: WordCategory;
  rounds: number;
  turns: number;
}

/**
 * A Draw & Guess room, as one player may see it.
 *
 * The word is never in another player's snapshot while it is in play: the
 * drawer is sent `word` while drawing and `wordChoices` while choosing, and
 * everybody is sent `word` once it is revealed.
 */
interface DrawAndGuessRoomState extends RoomState {
  gameType: 'draw-and-guess';
  rounds: number;
  phase: DrawAndGuessPhase;
  /** 1-based; 0 when no game is running. */
  currentRound: number;
  /** Turns played so far in this game, including the current one. */
  turn: number;
  /** The drawer's player id; '' when nobody is drawing. */
  currentDrawer: string;
  wordCategory: WordCategory | '';
  /** The word with its unrevealed letters as underscores; '' outside a turn. */
  hint: string;
  word?: string;
  wordChoices?: string[];
  /** True when the clock chose the drawer's word for them. */
  wordAutoPicked: boolean;
  /** Player ids that have scored this turn, and so cannot guess again. */
  scoredThisTurn: string[];
  /** What each player has gained this turn, the drawer included. */
  turnPoints: Record<string, number>;
  /**
   * How long the turn still waits for a drawer whose connection dropped; 0
   * when it is not waiting.
   */
  drawerHoldEndsInMs: number;
  lastGame: DrawAndGuessGameSummary | null;
}

/**
 * One cell, as everybody is allowed to see it:
 *
 * - `-1` hidden
 * - `0`-`8` revealed, with that many mines among its eight neighbours
 * - `9` a mine somebody hit, now common knowledge
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
   * public information alone, which is why it can be shown afterwards.
   */
  risk: number;
  hitMine: boolean;
  points: number;
  /** How many players picked this same cell, including this one. */
  sharedWith: number;
  /** True when the clock ran out and the server picked the safest cell. */
  autoPlayed: boolean;
}

/** waiting: no game; picking: the round is open; reveal: its outcome is shown. */
type MinesweeperPhase = 'waiting' | 'picking' | 'reveal';

interface MinesweeperGameSummary extends GameSummary {
  difficulty: MinesweeperDifficulty;
  rounds: number;
}

/** A Minesweeper room, as one player may see it. */
interface MinesweeperRoomState extends RoomState {
  gameType: 'minesweeper';
  difficulty: MinesweeperDifficulty;
  width: number;
  height: number;
  totalMines: number;
  /** Row-major, `width * height` entries. Never the hidden layout. */
  board: MinesweeperCellView[];
  phase: MinesweeperPhase;
  /** The round open or being revealed; 0 before the first. */
  round: number;
  /** Player ids that have locked a pick in this round, never which cell. */
  lockedIn: string[];
  /** This player's own pick in the open round, and nobody else's. */
  myPick: number | null;
  /** How many mines have been hit. */
  minesFound: number;
  /** What the latest resolved round came to; empty before the first. */
  lastRound: MinesweeperPickResult[];
  lastGame: MinesweeperGameSummary | null;
}

type AnyRoomState = DrawAndGuessRoomState | MinesweeperRoomState;

// ---------------------------------------------------------------------------
// Chat and the drawing

/**
 * player: somebody talking (or guessing wrong); system: neutral news, like a
 * join; alert: something went wrong for somebody, like a departure or a mine;
 * success: somebody scored.
 */
type ChatMessageKind = 'player' | 'system' | 'alert' | 'success';

interface ChatMessage {
  /** Unique within the room, in order. */
  id: number;
  kind: ChatMessageKind;
  /** The speaker, for player messages. */
  playerId?: string;
  username?: string;
  text: string;
}

interface Coordinate {
  x: number;
  y: number;
}

/** One continuous line, from pointer down to pointer up. */
interface CanvasStroke {
  color: string;
  size: number;
  points: Coordinate[];
}

// ---------------------------------------------------------------------------
// The events

type Ack<T> = (answer: T) => void;

interface ClientToServerEvents {
  /**
   * The first thing a client says on every connection: nothing, or the
   * identity it was issued before. A claim that does not check out simply
   * gets a new identity.
   */
  'session:identify': (
    claim: PlayerIdentity | null,
    ack: Ack<SessionInfo>,
  ) => void;

  'lobby:subscribe': (gameType: GameType) => void;
  'lobby:unsubscribe': (gameType: GameType) => void;

  'room:create': (
    request: RoomCreateRequest,
    ack: Ack<Result<{ roomId: string }>>,
  ) => void;
  /** Taking a seat, or taking back one this player still holds. */
  'room:join': (
    roomId: string,
    username: string,
    password: string,
    ack: Ack<Result>,
  ) => void;
  /**
   * Asked for by a room page once its listeners are live: answered with
   * `room:state`, the chat so far and anything else the game streams, or with
   * an error when this player holds no seat.
   */
  'room:sync': (roomId: string, ack: Ack<Result>) => void;
  'room:leave': (roomId: string) => void;
  'game:start': (roomId: string, ack: Ack<Result>) => void;

  /** Talking, and in Draw & Guess also guessing: the game decides which. */
  'chat:send': (roomId: string, text: string) => void;

  'dg:select-word': (roomId: string, word: string) => void;
  /** A stroke is described in full from its first point. */
  'dg:draw:start': (
    roomId: string,
    point: Coordinate,
    color: string,
    size: number,
  ) => void;
  'dg:draw:move': (
    roomId: string,
    point: Coordinate,
    color: string,
    size: number,
  ) => void;
  'dg:draw:end': (roomId: string) => void;
  'dg:draw:undo': (roomId: string) => void;
  'dg:draw:clear': (roomId: string) => void;

  'ms:pick': (roomId: string, index: number) => void;
}

interface ServerToClientEvents {
  'lobby:rooms': (gameType: GameType, rooms: AnyLobbyRoomInfo[]) => void;

  'room:state': (state: AnyRoomState) => void;

  'chat:history': (roomId: string, messages: ChatMessage[]) => void;
  'chat:message': (roomId: string, message: ChatMessage) => void;

  /** The whole drawing, for a player arriving mid-turn. */
  'dg:canvas:sync': (roomId: string, strokes: CanvasStroke[]) => void;
  'dg:canvas:start': (
    roomId: string,
    point: Coordinate,
    color: string,
    size: number,
  ) => void;
  'dg:canvas:move': (
    roomId: string,
    point: Coordinate,
    color: string,
    size: number,
  ) => void;
  'dg:canvas:end': (roomId: string) => void;
  'dg:canvas:undo': (roomId: string) => void;
  'dg:canvas:clear': (roomId: string) => void;
}

type ClientToServerEvent = keyof ClientToServerEvents;
type ServerToClientEvent = keyof ServerToClientEvents;

export type {
  GameType,
  RoomStatus,
  WordCategory,
  PlayerInfo,
  OwnerInfo,
  PlayerIdentity,
  SessionInfo,
  ErrorType,
  RoomError,
  Result,
  RoomCreateRequest,
  DrawAndGuessSettings,
  MinesweeperDifficulty,
  MinesweeperSettings,
  LobbyRoomInfo,
  DrawAndGuessLobbyRoomInfo,
  MinesweeperLobbyRoomInfo,
  AnyLobbyRoomInfo,
  RoomState,
  Standing,
  GameSummary,
  DrawAndGuessPhase,
  DrawAndGuessGameSummary,
  DrawAndGuessRoomState,
  MinesweeperCellView,
  MinesweeperPickResult,
  MinesweeperPhase,
  MinesweeperGameSummary,
  MinesweeperRoomState,
  AnyRoomState,
  ChatMessageKind,
  ChatMessage,
  Coordinate,
  CanvasStroke,
  Ack,
  ClientToServerEvents,
  ServerToClientEvents,
  ClientToServerEvent,
  ServerToClientEvent,
};
