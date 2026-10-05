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
type GameType = 'draw-and-guess' | 'minesweeper' | 'make-24' | 'pairs' | 'hush';

type RoomStatus = 'Open' | 'Full' | 'In Progress';

/** The word bank's categories. `server/libs/word-bank.ts` is keyed by these. */
type WordCategory =
  | 'Fruits'
  | 'Animals'
  | 'League of Legends'
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

/**
 * What a client presents in the Socket.IO handshake (`auth`), on every
 * connection: nothing, or the identity it was issued before. A claim that does
 * not check out simply gets a new identity.
 *
 * Identity travels in the handshake rather than as an event so that the server
 * knows who a connection is before it reads a single event from it. The client
 * buffers what it sends while offline and flushes it the moment it connects,
 * ahead of anything its own `connect` handler could say first.
 */
interface HandshakeAuth {
  identity: PlayerIdentity | null;
}

/** Sent as `session:ready` once the handshake has settled who a connection is. */
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
  /** The server holds as many rooms as it will; none can be made for now. */
  | 'tooManyRooms'
  | 'invalidRequest';

interface RoomError {
  type: ErrorType;
  message: string;
}

/** What an acknowledged request answers: success with its value, or why not. */
type Result<T extends object = object> =
  ({ ok: true } & T) | { ok: false; error: RoomError };

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
  settings:
    | DrawAndGuessSettings
    | MinesweeperSettings
    | Make24Settings
    | PairsSettings
    | HushSettings;
}

interface DrawAndGuessSettings {
  rounds: number;
}

type MinesweeperDifficulty = 'Small' | 'Medium' | 'Large';

interface MinesweeperSettings {
  difficulty: MinesweeperDifficulty;
}

interface Make24Settings {
  /** Hands in a game: 5 or 10. */
  hands: number;
}

/** Small is 4 × 4, 8 pairs; Large is 6 × 6, 18 pairs. */
type PairsBoard = 'Small' | 'Large';

interface PairsSettings {
  board: PairsBoard;
}

/** Hush has nothing to choose but the seats; its level count follows them. */
type HushSettings = Record<string, never>;

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

interface Make24LobbyRoomInfo extends LobbyRoomInfo {
  gameType: 'make-24';
  hands: number;
}

interface PairsLobbyRoomInfo extends LobbyRoomInfo {
  gameType: 'pairs';
  board: PairsBoard;
}

interface HushLobbyRoomInfo extends LobbyRoomInfo {
  gameType: 'hush';
}

type AnyLobbyRoomInfo =
  | DrawAndGuessLobbyRoomInfo
  | MinesweeperLobbyRoomInfo
  | Make24LobbyRoomInfo
  | PairsLobbyRoomInfo
  | HushLobbyRoomInfo;

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

/** On the wire, plain ASCII; a screen shows + − × ÷. */
type Make24Operator = '+' | '-' | '*' | '/';

/**
 * One step towards 24: the cards at `left` and `right`, as they stand after
 * the steps before, make a new card in the left card's place.
 */
interface Make24Step {
  left: number;
  op: Make24Operator;
  right: number;
}

/** waiting: no game; solving: the hand is open; reveal: its results are shown. */
type Make24Phase = 'waiting' | 'solving' | 'reveal';

/** Somebody has solved the open hand: who, and for what. Never how. */
interface Make24Solve {
  playerId: string;
  username: string;
  points: number;
  /** Whole seconds that were left on the hand's clock. */
  secondsLeft: number;
}

/** One player's part in a finished hand. */
interface Make24HandResult extends Make24Solve {
  solved: boolean;
  /** How they made 24, "(8 − 4) × (7 − 1)"; '' when they did not. */
  expression: string;
}

interface Make24GameSummary extends GameSummary {
  /** Hands played; fewer than the game's when it ended early. */
  hands: number;
}

/**
 * A Make 24 room, as one player may see it.
 *
 * While a hand is open, `solved` says who has made 24 and nobody's way of
 * doing it, which would give the hand away; the viewer's own is in `mySolve`.
 */
interface Make24RoomState extends RoomState {
  gameType: 'make-24';
  hands: number;
  phase: Make24Phase;
  /** The hand open or being revealed, from 1; 0 between games. */
  hand: number;
  /** The hand's four cards, smallest first; empty between games. */
  deal: number[];
  /** Who has solved the open hand, first first. */
  solved: Make24Solve[];
  /** This player's own solve of the open hand, and nobody else's. */
  mySolve: Make24HandResult | null;
  /** Every player's result for the latest finished hand, best first. */
  lastHand: Make24HandResult[];
  /** That hand's cards, which stay on the table after the game ends. */
  lastDeal: number[];
  /** One way to make 24 from the latest finished hand's cards; '' before one. */
  lastSolution: string;
  lastGame: Make24GameSummary | null;
}

/**
 * waiting: no game; flipping: a player is turning over two cards; showing:
 * two that did not match are up for everybody, before they turn back.
 */
type PairsPhase = 'waiting' | 'flipping' | 'showing';

/**
 * A card in its place. Its symbol, an index into the Pairs symbols, is sent
 * only while it is up or matched, so where the others lie never leaves the
 * server.
 */
interface PairsCardView {
  state: 'down' | 'up' | 'matched';
  symbol: number | null;
}

interface PairsGameSummary extends GameSummary {
  board: PairsBoard;
  /** Pairs found; fewer than the board's when the game ended early. */
  pairs: number;
}

/** A Pairs room, as one player may see it. Points are pairs found. */
interface PairsRoomState extends RoomState {
  gameType: 'pairs';
  board: PairsBoard;
  phase: PairsPhase;
  /**
   * Every card in its place, row by row: the board in play, or the last
   * game's as it ended; empty before the first game.
   */
  cards: PairsCardView[];
  pairsFound: number;
  /** Whose turn it is; null between games. */
  turnPlayerId: string | null;
  /** Whose turn comes next, skipping anybody not connected. */
  nextPlayerId: string | null;
  /** The places of the two cards that just did not match, while they show. */
  lastMiss: number[];
  lastGame: PairsGameSummary | null;
}

// ---------------------------------------------------------------------------
// Hush

/**
 * waiting: no game; ready: everybody presses Ready, and nobody holds cards
 * yet; countdown: the hands are dealt, and play opens when it ends; playing:
 * anybody plays their lowest card; mistake: a card went over a lower one, and
 * play stops for a moment; paused: a player who holds cards has dropped;
 * cleared: the level is done. The chat is locked from countdown to paused.
 */
type HushPhase =
  | 'waiting'
  | 'ready'
  | 'countdown'
  | 'playing'
  | 'mistake'
  | 'paused'
  | 'cleared';

/** A card on the pile, and who played it. */
interface HushPlay {
  card: number;
  playerId: string;
}

/**
 * A card that left a hand without being played: under a card played over it
 * (`mistake`), or with a player who left (`left`).
 */
interface HushDiscard {
  card: number;
  playerId: string;
  reason: 'mistake' | 'left';
}

/** What everybody may know about one player's hand. */
interface HushSeat {
  /** How many cards they hold. */
  held: number;
  /** Whether they have pressed Ready for the coming level. */
  ready: boolean;
}

/** The play that just cost a life, while it shows. */
interface HushMistake {
  playerId: string;
  card: number;
  /** Every card under it, from every hand, lowest first. */
  discarded: HushDiscard[];
}

/** One level of a game, as it went. */
interface HushLevelRecord {
  level: number;
  livesLost: number;
  /** A clean level wins back a lost life. */
  lifeBack: boolean;
  /** False for the level the game ended on without clearing it. */
  cleared: boolean;
}

/** A player's cards still held when the game ended, shown to everybody. */
interface HushHeld {
  playerId: string;
  cards: number[];
}

/** Every player's points are the levels the team cleared: one result for all. */
interface HushGameSummary extends GameSummary {
  levels: number;
  levelsCleared: number;
  won: boolean;
  /** Lives left at the end. */
  lives: number;
  history: HushLevelRecord[];
  held: HushHeld[];
}

/** A Hush room, as one player may see it: their own cards and nobody else's. */
interface HushRoomState extends RoomState {
  gameType: 'hush';
  phase: HushPhase;
  /** The level being played, from 1; 0 between games. */
  level: number;
  /** Levels in this game; between games, what a game would have now. */
  levels: number;
  lives: number;
  /** The viewer's own cards, lowest first. */
  hand: number[];
  /** Every seated player's card count and ready state, by player id. */
  table: Record<string, HushSeat>;
  /** This level's pile, lowest first; between games, the last one as it ended. */
  pile: HushPlay[];
  /** This level's discards, lowest first. */
  discards: HushDiscard[];
  /** While `mistake` shows. */
  lastMistake: HushMistake | null;
  /** While `cleared` shows: the level just cleared. */
  lastLevel: HushLevelRecord | null;
  lastGame: HushGameSummary | null;
}

type AnyRoomState =
  | DrawAndGuessRoomState
  | MinesweeperRoomState
  | Make24RoomState
  | PairsRoomState
  | HushRoomState;

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

  /** A solution to the open hand, as the steps that made it. */
  't24:solve': (roomId: string, steps: Make24Step[]) => void;

  /** Turning over the card at `index`, on your turn. */
  'pairs:flip': (roomId: string, index: number) => void;

  /** Ready for the coming level; once a level, and only before it starts. */
  'hush:ready': (roomId: string) => void;
  /** Playing `card`, which must still be the player's lowest. */
  'hush:play': (roomId: string, card: number) => void;
}

interface ServerToClientEvents {
  /**
   * The first thing the server says on every connection: who this connection
   * is, which the client stores for the next one.
   */
  'session:ready': (session: SessionInfo) => void;
  /**
   * Another connection presented this one's identity, a duplicated tab most
   * likely, and took over; this one is closed next. A client that reconnected
   * on its own would take the identity back, and the two would trade it
   * forever, so it waits for the player to choose.
   */
  'session:replaced': () => void;
  /**
   * The server is shutting down, for a deploy or a restart, and every room
   * goes with it. Sent to every connection just before it is closed, so a
   * room page can say why its room ended rather than find it missing later.
   */
  'server:closing': () => void;

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
  HandshakeAuth,
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
  Make24Settings,
  Make24LobbyRoomInfo,
  Make24Operator,
  Make24Step,
  Make24Phase,
  Make24Solve,
  Make24HandResult,
  Make24GameSummary,
  Make24RoomState,
  PairsBoard,
  PairsSettings,
  PairsLobbyRoomInfo,
  PairsPhase,
  PairsCardView,
  PairsGameSummary,
  PairsRoomState,
  HushSettings,
  HushLobbyRoomInfo,
  HushPhase,
  HushPlay,
  HushDiscard,
  HushSeat,
  HushMistake,
  HushLevelRecord,
  HushHeld,
  HushGameSummary,
  HushRoomState,
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
