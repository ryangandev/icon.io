import type { DrawAndGuessRoomView } from '../models/types';

const roomInfoInitialObject: DrawAndGuessRoomView = {
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
  wordCategory: '',
  wordChoices: [],
  phaseEndsInMs: 0,
};

export { roomInfoInitialObject };
