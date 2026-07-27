import type {
  DrawAndGuessLobbyRoomInfo,
  DrawAndGuessRoomState,
  DrawAndGuessSettings,
  DrawAndGuessState,
} from '../../models/types.js';
import type { Room } from '../../libs/rooms/types.js';
import { getRemainingPhaseMs } from '../../libs/utils.js';
import { createRoomCanvas } from './canvas.js';

/** A room that has been created but not yet played in. */
const createState = (settings: DrawAndGuessSettings): DrawAndGuessState => ({
  rounds: settings.rounds,
  currentDrawer: '',
  currentWord: '',
  currentWordHint: '',
  currentRound: 0,
  isWordSelectingPhase: false,
  isDrawingPhase: false,
  isReviewingPhase: false,
  drawerQueue: new Set(),
  wordCategory: '',
  wordChoices: [],
  scoredThisTurn: new Set(),
  canvas: createRoomCanvas(),
});

/**
 * The room summary shown in the lobby. This payload goes to everyone watching
 * the Draw & Guess lobby, so it carries `hasPassword` rather than the password
 * itself — the frontend only ever used the field as a boolean to pick a lock
 * icon, while the raw value was readable by anyone who opened the lobby.
 */
const toLobbyInfo = (
  room: Room<DrawAndGuessState>,
): DrawAndGuessLobbyRoomInfo => ({
  gameType: 'draw-and-guess',
  roomId: room.roomId,
  roomName: room.roomName,
  owner: room.owner,
  status: room.status,
  currentPlayerCount: room.currentPlayerCount,
  maxPlayers: room.maxPlayers,
  hasPassword: room.password !== '',
  rounds: room.game.rounds,
});

/**
 * The full room snapshot broadcast to the players inside a room. Emitting the
 * internal room object directly leaked the password, and — during the drawing
 * phase — the very word everyone else is supposed to be guessing.
 *
 * `currentWord` and `wordChoices` are drawer-private while the word is in play,
 * so they are omitted from the broadcast rather than blanked: the client merges
 * this snapshot over its existing state, and an omitted key leaves the drawer's
 * own copy intact. Both are delivered to the drawer alone, by `dg:word-choices`
 * and `dg:word`, and revealed to the whole room by `dg:phase:review`.
 */
const toRoomState = (room: Room<DrawAndGuessState>): DrawAndGuessRoomState => {
  const game = room.game;
  const isWordInPlay = game.isWordSelectingPhase || game.isDrawingPhase;

  const roomState: DrawAndGuessRoomState = {
    ...toLobbyInfo(room),
    playerList: room.playerList,
    isGameStarted: room.isGameStarted,
    phaseEndsInMs: getRemainingPhaseMs(room),
    currentDrawer: game.currentDrawer,
    currentWordHint: game.currentWordHint,
    currentRound: game.currentRound,
    isWordSelectingPhase: game.isWordSelectingPhase,
    isDrawingPhase: game.isDrawingPhase,
    isReviewingPhase: game.isReviewingPhase,
    drawerQueue: [...game.drawerQueue],
    scoredThisTurn: [...game.scoredThisTurn],
    wordCategory: game.wordCategory,
  };

  if (!isWordInPlay) {
    roomState.currentWord = game.currentWord;
    roomState.wordChoices = game.wordChoices;
  }

  return roomState;
};

export { createState, toLobbyInfo, toRoomState };
