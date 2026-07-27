import type { DrawAndGuessRoomState } from '../../../shared/wire-types';

/**
 * What the Draw & Guess room page holds.
 *
 * The server's snapshot leaves out the two drawer-private fields while a word
 * is in play — omitted rather than blanked, so that merging a snapshot never
 * clobbers the drawer's own copy of the word. They arrive on their own events,
 * and this page always has *a* value for them, even if it is an empty one, so
 * every component downstream can take them as given.
 */
type DrawAndGuessRoomView = DrawAndGuessRoomState & {
  currentWord: string;
  wordChoices: string[];
};

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
} from '../../../shared/wire-types';

export type { DrawAndGuessRoomView };
