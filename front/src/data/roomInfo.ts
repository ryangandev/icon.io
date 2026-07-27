import type {
  DrawAndGuessRoomView,
  MinesweeperRoomState,
} from '../models/types';

const roomInfoInitialObject: DrawAndGuessRoomView = {
  gameType: 'draw-and-guess',
  roomId: '',
  roomName: '',
  owner: {
    username: '',
    playerId: '',
  },
  status: 'Open',
  currentPlayerCount: 0,
  maxPlayers: 0,
  rounds: 0,
  hasPassword: false,
  playerList: {},
  currentDrawer: '', // current drawer's player id
  currentWord: '',
  currentWordHint: '',
  currentRound: 0,
  isGameStarted: false,
  isWordSelectingPhase: false,
  isDrawingPhase: false,
  isReviewingPhase: false,
  drawerQueue: [],
  scoredThisTurn: [],
  wordCategory: '',
  wordChoices: [],
  phaseEndsInMs: 0,
};

/**
 * What a Minesweeper room page holds before the server has said anything. The
 * board is empty rather than a grid of hidden cells, so nothing is drawn until
 * a real snapshot arrives and says how big it is.
 */
const minesweeperRoomInitialObject: MinesweeperRoomState = {
  gameType: 'minesweeper',
  roomId: '',
  roomName: '',
  owner: {
    username: '',
    playerId: '',
  },
  status: 'Open',
  currentPlayerCount: 0,
  maxPlayers: 0,
  hasPassword: false,
  playerList: {},
  isGameStarted: false,
  phaseEndsInMs: 0,
  difficulty: 'Medium',
  width: 0,
  height: 0,
  totalMines: 0,
  board: [],
  round: 0,
  lockedIn: [],
  minesFound: 0,
  lastRound: [],
};

export { roomInfoInitialObject, minesweeperRoomInitialObject };
