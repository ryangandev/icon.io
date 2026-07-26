import { describe, expect, it } from 'vitest';
import {
  buildWordHint,
  revealablePositions,
  getDrawAndGuessLobbyRoomInfo,
  getDrawAndGuessRoomState,
  getRandomChoicesFromList,
  getRandomElementFromSet,
  getRemainingPhaseMs,
  getRoomStatus,
  resetPoints,
  resetReceivedPointsThisTurn,
} from '../libs/utils.js';
import type { DrawAndGuessDetailRoomInfo } from '../models/types.js';
import { createRoomCanvas } from '../socket/draw-and-guess/canvas.js';

const makeRoom = (
  overrides: Partial<DrawAndGuessDetailRoomInfo> = {},
): DrawAndGuessDetailRoomInfo => ({
  roomId: 'room-1',
  roomName: 'Room One',
  owner: { username: 'Owner', playerId: 'player-owner' },
  status: 'Open',
  currentPlayerCount: 2,
  maxPlayers: 4,
  rounds: 2,
  password: '',
  playerList: {
    'player-owner': {
      username: 'Owner',
      points: 0,
      receivedPointsThisTurn: false,
      isConnected: true,
    },
  },
  currentDrawer: '',
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
  phaseEndsAt: 0,
  canvas: createRoomCanvas(),
  ...overrides,
});

describe('getRoomStatus', () => {
  it('reports a started game as in progress regardless of size', () => {
    expect(getRoomStatus(2, 4, true)).toBe('In Progress');
    expect(getRoomStatus(4, 4, true)).toBe('In Progress');
  });

  it('reports a room as full only at capacity', () => {
    expect(getRoomStatus(3, 4, false)).toBe('Open');
    expect(getRoomStatus(4, 4, false)).toBe('Full');
  });
});

describe('getDrawAndGuessLobbyRoomInfo', () => {
  it('replaces the password with a boolean', () => {
    const locked = getDrawAndGuessLobbyRoomInfo(
      makeRoom({ password: 'hunter2' }),
    );

    expect(locked.hasPassword).toBe(true);
    expect(locked).not.toHaveProperty('password');
    expect(JSON.stringify(locked)).not.toContain('hunter2');
  });

  it('marks an unlocked room as having no password', () => {
    expect(getDrawAndGuessLobbyRoomInfo(makeRoom()).hasPassword).toBe(false);
  });

  it('carries no player list, so the lobby cannot see inside a room', () => {
    expect(getDrawAndGuessLobbyRoomInfo(makeRoom())).not.toHaveProperty(
      'playerList',
    );
  });
});

describe('getDrawAndGuessRoomState', () => {
  it('omits the word and the choices while the word is in play', () => {
    for (const phase of ['isWordSelectingPhase', 'isDrawingPhase'] as const) {
      const state = getDrawAndGuessRoomState(
        makeRoom({
          [phase]: true,
          currentWord: 'giraffe',
          wordChoices: ['giraffe', 'kettle', 'anchor'],
        }),
      );

      // Omitted rather than blanked: the client merges this over its own
      // state, so a blank would wipe the drawer's copy of the word.
      expect(state).not.toHaveProperty('currentWord');
      expect(state).not.toHaveProperty('wordChoices');
      expect(JSON.stringify(state)).not.toContain('giraffe');
    }
  });

  it('reveals the word once the guessing is over', () => {
    const state = getDrawAndGuessRoomState(
      makeRoom({ isReviewingPhase: true, currentWord: 'giraffe' }),
    );

    expect(state.currentWord).toBe('giraffe');
  });

  it('never carries the room password', () => {
    const state = getDrawAndGuessRoomState(makeRoom({ password: 'letmein' }));

    expect(state).not.toHaveProperty('password');
    expect(state.hasPassword).toBe(true);
    expect(JSON.stringify(state)).not.toContain('letmein');
  });

  it('sends the drawer queue as an array, which survives serialization', () => {
    const state = getDrawAndGuessRoomState(
      makeRoom({ drawerQueue: new Set(['a', 'b']) }),
    );

    expect(state.drawerQueue).toEqual(['a', 'b']);
    expect(JSON.parse(JSON.stringify(state)).drawerQueue).toEqual(['a', 'b']);
  });
});

describe('getRemainingPhaseMs', () => {
  it('is zero for an idle room rather than a large negative number', () => {
    expect(getRemainingPhaseMs(makeRoom({ phaseEndsAt: 0 }))).toBe(0);
  });

  it('never goes negative once the deadline has passed', () => {
    expect(
      getRemainingPhaseMs(makeRoom({ phaseEndsAt: Date.now() - 5000 })),
    ).toBe(0);
  });

  it('is a duration, not the deadline itself', () => {
    const remaining = getRemainingPhaseMs(
      makeRoom({ phaseEndsAt: Date.now() + 10_000 }),
    );

    expect(remaining).toBeGreaterThan(9000);
    expect(remaining).toBeLessThanOrEqual(10_000);
  });
});

describe('getRandomChoicesFromList', () => {
  it('returns the requested number of distinct entries', () => {
    const choices = getRandomChoicesFromList(['a', 'b', 'c', 'd', 'e'], 3);

    expect(choices).toHaveLength(3);
    expect(new Set(choices).size).toBe(3);
  });

  // Asking for more distinct choices than exist used to spin forever inside
  // a while loop, taking the whole single-threaded server with it.
  it('terminates when asked for more choices than the list holds', () => {
    expect(getRandomChoicesFromList(['a', 'b'], 5)).toHaveLength(2);
    expect(getRandomChoicesFromList([], 3)).toEqual([]);
  });
});

describe('getRandomElementFromSet', () => {
  it('returns undefined for an empty set rather than claiming a string', () => {
    expect(getRandomElementFromSet(new Set())).toBeUndefined();
  });

  it('always returns a member of the set', () => {
    const members = new Set(['x', 'y', 'z']);
    for (let i = 0; i < 50; i++) {
      expect(members.has(getRandomElementFromSet(members)!)).toBe(true);
    }
  });
});

describe('buildWordHint', () => {
  it('hides every visible character but keeps the spacing', () => {
    expect(buildWordHint('ice cream')).toBe('___ _____');
  });

  it('fills in the positions the clock has given away', () => {
    expect(buildWordHint('ice cream', new Set([0, 4]))).toBe('i__ c____');
  });

  it('offers every position but the spaces for revealing', () => {
    expect(revealablePositions('ice cream')).toEqual([0, 1, 2, 4, 5, 6, 7, 8]);
  });
});

describe('point resets', () => {
  const playerList = {
    a: {
      username: 'A',
      points: 300,
      receivedPointsThisTurn: true,
      isConnected: true,
    },
    b: {
      username: 'B',
      points: 100,
      receivedPointsThisTurn: true,
      isConnected: true,
    },
  };

  it('resetPoints zeroes the scores without touching the names', () => {
    const reset = resetPoints(playerList);

    expect(reset.a.points).toBe(0);
    expect(reset.b.points).toBe(0);
    expect(reset.a.username).toBe('A');
  });

  it('resetReceivedPointsThisTurn clears the flag but keeps the scores', () => {
    const reset = resetReceivedPointsThisTurn(playerList);

    expect(reset.a.receivedPointsThisTurn).toBe(false);
    expect(reset.a.points).toBe(300);
  });
});
