import { describe, expect, it } from 'vitest';
import type { DrawAndGuessState } from '../models/types.js';
import type { Room } from '../libs/rooms/types.js';
import {
  createState,
  toLobbyInfo,
  toRoomState,
} from '../socket/draw-and-guess/state.js';
import {
  buildWordHint,
  getRandomChoicesFromList,
  revealablePositions,
} from '../socket/draw-and-guess/words.js';

/**
 * The two builders that turn a room into what a client is allowed to see, and
 * the word helpers they lean on.
 *
 * These used to be `getDrawAndGuessLobbyRoomInfo` and
 * `getDrawAndGuessRoomState` in `libs/utils.ts`. They are the same functions
 * with the same job — the extraction moved them next to the game whose wire
 * format they define, and made them two members of the interface the room layer
 * calls rather than two exports anyone could reach for.
 */

const makeRoom = (
  overrides: Partial<Room<DrawAndGuessState>> = {},
  gameOverrides: Partial<DrawAndGuessState> = {},
): Room<DrawAndGuessState> => ({
  gameType: 'draw-and-guess',
  roomId: 'room-1',
  roomName: 'Room One',
  owner: { username: 'Owner', playerId: 'player-owner' },
  status: 'Open',
  currentPlayerCount: 2,
  maxPlayers: 4,
  password: '',
  playerList: {
    'player-owner': { username: 'Owner', points: 0, isConnected: true },
  },
  isGameStarted: false,
  phaseEndsAt: 0,
  ...overrides,
  game: { ...createState({ rounds: 2 }), ...gameOverrides },
});

describe('toLobbyInfo', () => {
  it('replaces the password with a boolean', () => {
    const locked = toLobbyInfo(makeRoom({ password: 'hunter2' }));

    expect(locked.hasPassword).toBe(true);
    expect(locked).not.toHaveProperty('password');
    expect(JSON.stringify(locked)).not.toContain('hunter2');
  });

  it('marks an unlocked room as having no password', () => {
    expect(toLobbyInfo(makeRoom()).hasPassword).toBe(false);
  });

  it('carries no player list, so the lobby cannot see inside a room', () => {
    expect(toLobbyInfo(makeRoom())).not.toHaveProperty('playerList');
  });

  it('says which game it is, so one lobby cannot show another’s rooms', () => {
    expect(toLobbyInfo(makeRoom()).gameType).toBe('draw-and-guess');
  });

  it('carries the round count, which is the game’s own setting', () => {
    expect(toLobbyInfo(makeRoom({}, { rounds: 4 })).rounds).toBe(4);
  });
});

describe('toRoomState', () => {
  it('omits the word and the choices while the word is in play', () => {
    for (const phase of ['isWordSelectingPhase', 'isDrawingPhase'] as const) {
      const state = toRoomState(
        makeRoom(
          {},
          {
            [phase]: true,
            currentWord: 'giraffe',
            wordChoices: ['giraffe', 'kettle', 'anchor'],
          },
        ),
      );

      // Omitted rather than blanked: the client merges this over its own
      // state, so a blank would wipe the drawer's copy of the word.
      expect(state).not.toHaveProperty('currentWord');
      expect(state).not.toHaveProperty('wordChoices');
      expect(JSON.stringify(state)).not.toContain('giraffe');
    }
  });

  it('reveals the word once the guessing is over', () => {
    const state = toRoomState(
      makeRoom({}, { isReviewingPhase: true, currentWord: 'giraffe' }),
    );

    expect(state.currentWord).toBe('giraffe');
  });

  it('never carries the room password', () => {
    const state = toRoomState(makeRoom({ password: 'letmein' }));

    expect(state).not.toHaveProperty('password');
    expect(state.hasPassword).toBe(true);
    expect(JSON.stringify(state)).not.toContain('letmein');
  });

  it('sends the drawer queue as an array, which survives serialization', () => {
    const state = toRoomState(
      makeRoom({}, { drawerQueue: new Set(['a', 'b']) }),
    );

    expect(state.drawerQueue).toEqual(['a', 'b']);
    expect(JSON.parse(JSON.stringify(state)).drawerQueue).toEqual(['a', 'b']);
  });

  /*
   * This used to be a `receivedPointsThisTurn` boolean on every PlayerInfo,
   * which put a field only a drawing phase means anything to on the shape
   * every game shares. It is the game's state now, and reaches the wire as a
   * list of player ids — through the same serialization the drawer queue takes.
   */
  it('reports who has already scored, as ids rather than a flag per player', () => {
    const state = toRoomState(
      makeRoom({}, { scoredThisTurn: new Set(['player-owner']) }),
    );

    expect(state.scoredThisTurn).toEqual(['player-owner']);
    expect(state.playerList['player-owner']).not.toHaveProperty(
      'receivedPointsThisTurn',
    );
  });

  it('carries the live phase clock as a duration', () => {
    const state = toRoomState(makeRoom({ phaseEndsAt: Date.now() + 10_000 }));

    expect(state.phaseEndsInMs).toBeGreaterThan(9000);
    expect(state.phaseEndsInMs).toBeLessThanOrEqual(10_000);
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
