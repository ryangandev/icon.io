import type { CanvasStroke, WordCategory } from '../../shared/wire-types.js';

/**
 * Server-private state.
 *
 * Everything a client can see is defined once, in `shared/wire-types.d.ts`, and
 * re-exported at the bottom of this file so that the rest of the backend can go
 * on importing its types from one place. What is left here is what never leaves
 * the process: the word while it is being guessed, and the drawing in the
 * mutable form the relay maintains it in.
 *
 * The room itself is no longer described here. `RoomInfo` and
 * `DrawAndGuessDetailRoomInfo` were one type that mixed the two — a room's name,
 * seats and password alongside a drawer queue and a canvas — which is precisely
 * the seam the extraction cut along. What is generic is `Room<TGameState>` in
 * `libs/rooms/types.ts`; what is Draw & Guess's is `DrawAndGuessState` below,
 * and it hangs off `room.game`.
 */

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
 * Everything Draw & Guess knows that no other game would.
 *
 * `scoredThisTurn` used to be a `receivedPointsThisTurn` boolean on `PlayerInfo`
 * — the shared, every-game shape — which meant the room layer carried a field
 * that only means something inside a drawing phase. Per-player facts a game
 * cares about live in the game's own state, keyed by the same player id.
 */
interface DrawAndGuessState {
  rounds: number;
  currentDrawer: string; // current drawer's player id
  currentWord: string;
  currentWordHint: string;
  currentRound: number;
  isWordSelectingPhase: boolean;
  isDrawingPhase: boolean;
  isReviewingPhase: boolean;
  drawerQueue: Set<string>; // player ids still to draw this round
  wordCategory: WordCategory | ''; // '' when no game is in progress
  wordChoices: string[];
  /** Player ids that have already scored this turn, and so cannot guess again. */
  scoredThisTurn: Set<string>;
  // Sent to arrivals on its own rather than with the room snapshot: a snapshot
  // goes out every time anyone joins or leaves, and the drawing is the largest
  // thing in the room.
  canvas: RoomCanvas;
}

/**
 * The wire contract. A module's `toLobbyInfo` and `toRoomState` are the only way
 * the internal types above become these, which is what keeps a password or a
 * live word from leaking by someone emitting a room object wholesale.
 */
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
} from '../../shared/wire-types.js';

export type { RoomCanvas, DrawAndGuessState };
