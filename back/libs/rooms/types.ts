import type {
  AnyLobbyRoomInfo,
  AnyRoomState,
  ChatMessage,
  ChatMessageKind,
  GameType,
  OwnerInfo,
  PlayerInfo,
  RoomStatus,
} from '../../../shared/wire-types.js';
import type { PlayerSessionRegistry } from '../player-session.js';
import type { IoServer, IoSocket } from './emit.js';

/**
 * A room's chat: the messages a page arriving now is sent as `chat:history`,
 * and the id the next one will carry.
 */
interface RoomChat {
  nextId: number;
  /** The most recent messages, oldest first, at most `CHAT_HISTORY_LIMIT`. */
  messages: ChatMessage[];
}

/**
 * A room, minus whatever game is being played in it.
 *
 * Everything here is true of every game: it has a name, an owner, a password,
 * a set of seats keyed by player id, one clock and a chat. The game's own
 * state (a word and a canvas, a minefield and a round of picks) hangs off
 * `game`, and the room layer never looks inside it.
 *
 * Keyed by player id rather than socket id. A socket id changes on every
 * reload; a player id does not, which is what lets a seat, a score and a turn
 * survive a refresh. See `libs/player-session.ts`.
 */
interface Room<TGameState = unknown> {
  gameType: GameType;
  roomId: string;
  roomName: string;
  owner: OwnerInfo;
  status: RoomStatus;
  currentPlayerCount: number;
  maxPlayers: number;
  /** Never leaves the process. The wire carries `hasPassword`. */
  password: string;
  playerList: Record<string, PlayerInfo>;
  isGameStarted: boolean;
  /** Epoch ms the current phase ends; 0 when idle. */
  phaseEndsAt: number;
  chat: RoomChat;
  game: TGameState;
}

/**
 * What a game module is handed, and all it is handed.
 *
 * Deliberately small. A module gets the socket server, the identity registry,
 * and a way to look rooms up, to tell their players something changed and to
 * announce things. It does not get the room layer's timers, and the room layer
 * does not get its.
 */
interface GameContext {
  io: IoServer;
  sessions: PlayerSessionRegistry;
  rooms: RoomLookup;
}

interface RoomLookup {
  /** Every room on the server, of every game, keyed by id. */
  readonly all: Record<string, Room>;
  get(roomId: string): Room | undefined;
  /**
   * The room, but only if it is playing this game. A room id is public (it
   * goes out in every lobby broadcast), so a handler that assumed the id it
   * was handed belonged to its own game would be reading another game's state
   * through its own type.
   */
  ofType<TGameState>(
    roomId: string,
    gameType: GameType,
  ): Room<TGameState> | undefined;
  /** Rebroadcasts one game's room list to everyone watching that lobby. */
  emitLobby(gameType: GameType): void;
  /**
   * Something visible in the room changed: every seated, connected player is
   * sent `room:state`, each built for them by the room's module.
   *
   * The one way room state reaches a client. Calls within one synchronous run
   * are coalesced into one snapshot per player, sent once the run is over, so
   * a module can call this after every change without the room seeing the
   * steps in between (a turn that ends and the next one that starts).
   */
  emitState(room: Room): void;
  /** A line in the room's chat that nobody in particular said. */
  announce(
    roomId: string,
    kind: Exclude<ChatMessageKind, 'player'>,
    text: string,
  ): void;
}

/**
 * What a module makes of a chat message:
 *
 * - `chat`: an ordinary message; the room layer posts it.
 * - `consumed`: the game used it (a correct guess) and said whatever it had to.
 * - `blocked`: nobody sees it (a drawer who would be giving the word away).
 */
type ChatVerdict = 'chat' | 'consumed' | 'blocked';

/**
 * One game, as the room layer sees it.
 *
 * The room layer calls these; nothing else about the game is visible to it.
 * The two halves of the split are worth stating, because getting them wrong is
 * what an abstraction with a single consumer usually gets wrong:
 *
 * - **Timers.** The room layer owns exactly one kind, the seat expiry that
 *   holds a disconnected player's place. Every other timer belongs to a module,
 *   which keeps its own registry and is told to empty it by `disposeRoom`.
 * - **Per-player state.** `PlayerInfo` carries what every game has: a name, a
 *   score, whether they are still connected. Anything else about a player
 *   belongs in the module's own state, keyed by the same player id.
 */
interface GameModule<TGameState = unknown, TSettings = unknown> {
  readonly gameType: GameType;
  readonly minPlayers: number;
  readonly maxPlayers: number;

  /**
   * Reads the game-specific half of a create request, or returns null to
   * reject it. The generic half (name, seats, password) is validated by the
   * room layer before this is called.
   */
  parseSettings(raw: unknown): TSettings | null;
  createState(settings: TSettings): TGameState;

  /** The room as its lobby table shows it. Must not carry the password. */
  toLobbyInfo(room: Room<TGameState>): AnyLobbyRoomInfo;
  /**
   * The room as one player may see it. Must not carry the password, nor
   * anything in play that this viewer is not allowed to know.
   */
  toRoomState(room: Room<TGameState>, viewerId: string): AnyRoomState;

  /**
   * Anything one arriving socket needs beyond the snapshot and the chat, such
   * as a drawing. Called by `room:sync` after both have been sent to that
   * socket alone, which is the one moment its listeners are known to be live.
   */
  syncTo(socket: IoSocket, room: Room<TGameState>, playerId: string): void;

  /**
   * A seated player said something. Optional: a game without an opinion has
   * every message posted as it is.
   */
  handleChat?(
    room: Room<TGameState>,
    playerId: string,
    text: string,
  ): ChatVerdict;

  /** The owner pressed start. Throws a `RequestError` if they may not. */
  startGame(room: Room<TGameState>, playerId: string): void;

  /** The seat is already gone from `playerList` by the time this is called. */
  onDeparture(room: Room<TGameState>, playerId: string): void;
  /** The seat is being held; the player is marked away. */
  onDisconnect(room: Room<TGameState>, playerId: string): void;
  /** They proved who they were inside the grace period. */
  onReturn(room: Room<TGameState>, playerId: string): void;

  /** Drop this room's pending timers; the room itself is going away. */
  disposeRoom(roomId: string): void;
  /** Drop every room's timers; the server is closing. */
  dispose(): void;

  /** Wire up this game's own inbound events on a new connection. */
  registerHandlers(socket: IoSocket): void;
}

export type {
  Room,
  RoomChat,
  RoomLookup,
  GameContext,
  GameModule,
  ChatVerdict,
};
