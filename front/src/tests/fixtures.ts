import type {
  DrawAndGuessRoomState,
  Make24RoomState,
  MinesweeperRoomState,
  PlayerInfo,
} from '../../../shared/wire-types';

/** The viewer in every fixture, and the room's host unless a test says not. */
export const ME = 'p1';

const players: Record<string, PlayerInfo> = {
  p1: { username: 'Ryan', points: 0, isConnected: true },
  p2: { username: 'Maya', points: 0, isConnected: true },
};

const room = {
  roomId: 'r1',
  roomName: 'Friday table',
  owner: { username: 'Ryan', playerId: ME },
  status: 'Open' as const,
  currentPlayerCount: 2,
  maxPlayers: 8,
  hasPassword: false,
  playerList: players,
  isGameStarted: false,
  phaseEndsInMs: 0,
};

export function minesweeperState(
  overrides: Partial<MinesweeperRoomState> = {},
): MinesweeperRoomState {
  return {
    ...room,
    gameType: 'minesweeper',
    difficulty: 'Small',
    width: 9,
    height: 9,
    totalMines: 10,
    board: Array.from({ length: 81 }, () => -1),
    phase: 'waiting',
    round: 0,
    lockedIn: [],
    myPick: null,
    minesFound: 0,
    lastRound: [],
    lastGame: null,
    ...overrides,
  };
}

export function drawAndGuessState(
  overrides: Partial<DrawAndGuessRoomState> = {},
): DrawAndGuessRoomState {
  return {
    ...room,
    gameType: 'draw-and-guess',
    rounds: 2,
    phase: 'waiting',
    currentRound: 0,
    turn: 0,
    currentDrawer: '',
    wordCategory: '',
    hint: '',
    wordAutoPicked: false,
    scoredThisTurn: [],
    turnPoints: {},
    drawerHoldEndsInMs: 0,
    lastGame: null,
    ...overrides,
  };
}

export function make24State(
  overrides: Partial<Make24RoomState> = {},
): Make24RoomState {
  return {
    ...room,
    gameType: 'make-24',
    hands: 5,
    phase: 'waiting',
    hand: 0,
    deal: [],
    solved: [],
    mySolve: null,
    lastHand: [],
    lastDeal: [],
    lastSolution: '',
    lastGame: null,
    ...overrides,
  };
}
