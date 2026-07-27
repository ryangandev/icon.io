import type { Server, Socket } from 'socket.io';
import type {
  GameType,
  LobbyRoomInfo,
  OwnerInfo,
  PlayerInfo,
  RoomState,
  RoomStatus,
} from '../../../shared/wire-types.js';
import type { PlayerSessionRegistry } from '../player-session.js';

/**
 * A room, minus whatever game is being played in it.
 *
 * Everything here is true of every game: it has a name, an owner, a password,
 * a set of seats keyed by player id, and one clock. The game's own state — a
 * word and a canvas, a minefield and a round of picks — hangs off `game`, and
 * the room layer never looks inside it.
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
  game: TGameState;
}

/**
 * What a game module is handed, and all it is handed.
 *
 * Deliberately small. A module gets the socket server, the identity registry,
 * and a way to look rooms up and to announce things — it does not get the
 * room layer's timers, and the room layer does not get its.
 */
interface GameContext {
  io: Server;
  sessions: PlayerSessionRegistry;
  rooms: RoomLookup;
}

interface RoomLookup {
  /** Every room on the server, of every game, keyed by id. */
  readonly all: Record<string, Room>;
  get(roomId: string): Room | undefined;
  /**
   * The room, but only if it is playing this game. A room id is public — it
   * goes out in every lobby broadcast — so a handler that assumed the id it
   * was handed belonged to its own game would be reading another game's state
   * through its own type.
   */
  ofType<TGameState>(
    roomId: string,
    gameType: GameType,
  ): Room<TGameState> | undefined;
  /** Rebroadcasts one game's room list to everyone watching that lobby. */
  emitLobby(gameType: GameType): void;
  /** A system line in a room's chat. */
  announce(roomId: string, message: string): void;
}

/**
 * One game, as the room layer sees it.
 *
 * The room layer calls these; nothing else about the game is visible to it.
 * The two halves of the split are worth stating, because getting them wrong is
 * what an abstraction with a single consumer usually gets wrong:
 *
 * - **Timers.** The room layer owns exactly one kind — the seat expiry that
 *   holds a disconnected player's place. Every other timer belongs to a module,
 *   which keeps its own registry and is told to empty it by `disposeRoom`.
 *   Draw & Guess keeps four kinds (phase, drawer hold, letter reveals);
 *   Minesweeper keeps one. Neither number is the room layer's business.
 * - **Per-player state.** `PlayerInfo` carries what every game has — a name, a
 *   score, whether they are still connected. Anything else about a player
 *   belongs in the module's own state, keyed by the same player id.
 */
interface GameModule<TGameState = unknown, TSettings = unknown> {
  readonly gameType: GameType;
  readonly minPlayers: number;
  readonly maxPlayers: number;

  /**
   * Reads the game-specific half of a create request, or returns null to
   * reject it. The generic half — name, seats, password — is validated by the
   * room layer before this is called.
   */
  parseSettings(raw: unknown): TSettings | null;
  createState(settings: TSettings): TGameState;

  /** The room as its lobby table shows it. Must not carry the password. */
  toLobbyInfo(room: Room<TGameState>): LobbyRoomInfo;
  /** The room as its players see it. Must not carry secrets in play. */
  toRoomState(room: Room<TGameState>): RoomState;

  /**
   * Anything one arriving socket needs beyond the snapshot: a canvas, a board,
   * a word only the drawer may see. Called after `room:state` has been sent to
   * that socket alone, which is the one moment its listeners are known to be
   * live.
   */
  syncTo(socket: Socket, room: Room<TGameState>, playerId: string): void;

  /** The owner pressed start. Throws a `CustomError` if they may not. */
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
  registerHandlers(socket: Socket): void;
}

export type { Room, RoomLookup, GameContext, GameModule };
