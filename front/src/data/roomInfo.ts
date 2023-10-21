import { DrawAndGuessDetailRoomInfo } from '../models/types';

const roomInfoInitialObject: DrawAndGuessDetailRoomInfo = {
    roomId: '',
    roomName: '',
    owner: {
        username: '',
        socketId: '',
    },
    status: 'Open',
    currentPlayerCount: 0,
    maxPlayers: 0,
    rounds: 0,
    password: '',
    playerList: {},
    currentDrawer: '', // current drawer's socket id
    currentWord: '',
    currentWordHint: '',
    currentRound: 0,
    isGameStarted: false,
    isWordSelectingPhase: false,
    isDrawingPhase: false,
    isReviewingPhase: false,
    drawerQueue: new Set(),
    wordCategory: '',
    wordChoices: [],
};

export { roomInfoInitialObject };
