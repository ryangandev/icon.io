import type {
  MinesweeperPickResult,
  MinesweeperSettings,
} from '../../models/types.js';
import type { CustomError, ErrorType } from '../../models/error.js';
import type { GameContext, Room } from '../../libs/rooms/types.js';
import { emitToRoom } from '../../libs/rooms/emit.js';
import {
  getRemainingPhaseMs,
  getRoomStatus,
  resetPoints,
} from '../../libs/utils.js';
import {
  minesweeperDurationsInSeconds as defaultDurations,
  type MinesweeperDurationsInSeconds,
} from '../../libs/game-clock.js';
import {
  createBoard,
  hiddenIndexes,
  isHidden,
  isResolved,
  markHitMine,
  minesFound,
  publicView,
  revealFrom,
} from './board.js';
import { mineProbabilities } from './probability.js';
import { pointsForPick } from './scoring.js';
import { toRoomState, type MinesweeperState } from './state.js';

const MIN_PLAYERS_TO_START = 2;

const roomError = (message: string, errorType: ErrorType): CustomError => {
  const error = new Error(message) as CustomError;
  error.errorType = errorType;
  return error;
};

type MinesweeperRoom = Room<MinesweeperState>;

/**
 * The safest cell on the board, for a player who ran out of time.
 *
 * It reuses the same risk numbers everyone else was scored against, so an
 * auto-play is the move a cautious player would have made — and it forfeits the
 * base points, so it is never better than turning up.
 */
const safestHiddenCell = (room: MinesweeperRoom): number | undefined => {
  const hidden = hiddenIndexes(room.game.board);
  if (hidden.length === 0) return undefined;

  let safest = hidden[0];
  for (const index of hidden) {
    if ((room.game.risk[index] ?? 1) < (room.game.risk[safest] ?? 1)) {
      safest = index;
    }
  }
  return safest;
};

/**
 * Owns the round loop.
 *
 * A round is one window in which **everybody picks at once**, rather than a
 * turn that goes round the table. With up to eight seats, strictly sequential
 * turns would mean waiting two minutes between clicks; picking simultaneously
 * also means every player faces exactly the same board with exactly the same
 * information, which is the cleanest possible answer to "is this fair".
 *
 * What it costs is the one-at-a-time tension, and what it buys back is a
 * mind-game: everybody is choosing blind against everybody else, and picking
 * the obviously-good cell means sharing it.
 */
const createMinesweeperGameEngine = (
  ctx: GameContext,
  durations: MinesweeperDurationsInSeconds = defaultDurations,
) => {
  const { io } = ctx;
  /** One per room: either the pick window or the reveal pause. */
  const roundTimers = new Map<string, NodeJS.Timeout>();

  const roomOf = (roomId: string): MinesweeperRoom | undefined =>
    ctx.rooms.ofType<MinesweeperState>(roomId, 'minesweeper');

  const clearRoundTimer = (roomId: string) => {
    const pending = roundTimers.get(roomId);
    if (pending) {
      clearTimeout(pending);
      roundTimers.delete(roomId);
    }
  };

  const schedule = (
    roomId: string,
    durationInSeconds: number,
    onDue: () => void,
  ) => {
    clearRoundTimer(roomId);
    roundTimers.set(
      roomId,
      setTimeout(() => {
        roundTimers.delete(roomId);
        // The room may have been emptied and deleted while we waited.
        if (roomOf(roomId)) onDue();
      }, durationInSeconds * 1000),
    );
  };

  const startGame = (room: MinesweeperRoom, playerId: string) => {
    if (room.owner.playerId !== playerId) {
      throw roomError(
        'Only the room owner can start the game.',
        'notRoomOwner',
      );
    }
    if (room.isGameStarted) {
      throw roomError('The game has already started.', 'gameAlreadyStarted');
    }
    if (room.currentPlayerCount < MIN_PLAYERS_TO_START) {
      throw roomError(
        `At least ${MIN_PLAYERS_TO_START} players are required to start.`,
        'notEnoughPlayers',
      );
    }

    // A fresh minefield every game, so a room that plays twice is not playing
    // the same board with the answers already known.
    room.game.board = createBoard(room.game.difficulty);
    room.game.round = 0;
    room.game.picks.clear();
    room.game.lastRound = [];
    room.game.isRevealing = false;
    room.playerList = resetPoints(room.playerList);
    room.isGameStarted = true;
    room.status = getRoomStatus(
      room.currentPlayerCount,
      room.maxPlayers,
      room.isGameStarted,
    );

    console.log(
      `Minesweeper started in room ${room.roomId} on ${room.game.difficulty}.`,
    );

    emitToRoom(io, room.roomId, 'ms:game:started', {
      playerList: room.playerList,
      isGameStarted: room.isGameStarted,
      status: room.status,
      difficulty: room.game.difficulty,
    });
    ctx.rooms.announce(
      room.roomId,
      `Game has started! ${room.game.board.totalMines} mines on a ${room.game.board.width}×${room.game.board.height} board.`,
    );
    ctx.rooms.emitLobby('minesweeper');

    beginRound(room);
  };

  const beginRound = (room: MinesweeperRoom) => {
    const game = room.game;
    game.round += 1;
    game.picks.clear();
    game.isRevealing = false;

    // Computed once, from the public board, before anybody has picked. This is
    // the number every score in this round is made of.
    game.risk = mineProbabilities({
      width: game.board.width,
      height: game.board.height,
      totalMines: game.board.totalMines,
      cells: publicView(game.board),
    });

    room.phaseEndsAt = Date.now() + durations.round * 1000;

    emitToRoom(io, room.roomId, 'ms:round', {
      round: game.round,
      board: publicView(game.board),
      minesFound: minesFound(game.board),
      lockedIn: [],
      phaseEndsInMs: getRemainingPhaseMs(room),
    });

    schedule(room.roomId, durations.round, () => resolveRound(room));
  };

  /**
   * A player has chosen a cell. One pick each, and it is final — you cannot
   * watch who locks in and then change your mind, which is what keeps the
   * simultaneous window honest.
   */
  const pick = (roomId: string, playerId: string, index: number) => {
    const room = roomOf(roomId);
    if (!room) return;

    const game = room.game;
    if (!room.isGameStarted) return;
    if (game.isRevealing) return; // between rounds
    if (!room.playerList[playerId]) return; // not in this room
    if (game.picks.has(playerId)) return; // already committed
    if (index < 0 || index >= game.board.width * game.board.height) return;
    if (!isHidden(game.board, index)) return; // already resolved

    game.picks.set(playerId, index);

    emitToRoom(io, roomId, 'ms:locked', { lockedIn: [...game.picks.keys()] });

    maybeResolveEarly(room);
  };

  /**
   * Once everybody who *could* pick has, the rest of the window is dead time.
   *
   * Players inside their reconnect grace are not waited for: they cannot pick
   * while they are away, and holding the round open for them would cost the
   * room the whole window.
   */
  const maybeResolveEarly = (room: MinesweeperRoom) => {
    if (!room.isGameStarted || room.game.isRevealing) return;

    const stillChoosing = Object.entries(room.playerList).filter(
      ([playerId, player]) =>
        player.isConnected && !room.game.picks.has(playerId),
    );
    if (stillChoosing.length > 0) return;

    clearRoundTimer(room.roomId);
    resolveRound(room);
  };

  const resolveRound = (room: MinesweeperRoom) => {
    clearRoundTimer(room.roomId);
    const game = room.game;
    if (!room.isGameStarted) return;

    // Anybody present who did not choose gets the safest cell going.
    const autoPlayed = new Set<string>();
    for (const [playerId, player] of Object.entries(room.playerList)) {
      if (!player.isConnected || game.picks.has(playerId)) continue;
      const fallback = safestHiddenCell(room);
      if (fallback === undefined) break;
      game.picks.set(playerId, fallback);
      autoPlayed.add(playerId);
    }

    // How many players landed on each cell, which is what splits a reward.
    const pickedBy = new Map<number, string[]>();
    for (const [playerId, index] of game.picks) {
      const others = pickedBy.get(index);
      if (others) others.push(playerId);
      else pickedBy.set(index, [playerId]);
    }

    // Scored against the board as it was, before a single reveal is applied.
    const results: MinesweeperPickResult[] = [];
    for (const [playerId, index] of game.picks) {
      const player = room.playerList[playerId];
      if (!player) continue;

      const risk = game.risk[index] ?? 0;
      const hitMine = game.board.mines[index];
      const sharedWith = pickedBy.get(index)?.length ?? 1;
      const points = pointsForPick({
        risk,
        hitMine,
        sharedWith,
        autoPlayed: autoPlayed.has(playerId),
      });

      player.points += points;
      results.push({
        playerId,
        username: player.username,
        index,
        risk,
        hitMine,
        points,
        sharedWith,
        autoPlayed: autoPlayed.has(playerId),
      });
    }

    // Only now does the board move. A cell somebody else's cascade would have
    // opened still pays what it was worth when they chose it.
    for (const index of pickedBy.keys()) {
      if (game.board.mines[index]) markHitMine(game.board, index);
      else revealFrom(game.board, index);
    }

    game.lastRound = results;
    game.picks.clear();
    game.isRevealing = true;
    room.phaseEndsAt = Date.now() + durations.reveal * 1000;

    emitToRoom(io, room.roomId, 'ms:resolve', {
      results,
      board: publicView(game.board),
      playerList: room.playerList,
      minesFound: minesFound(game.board),
      phaseEndsInMs: getRemainingPhaseMs(room),
    });

    for (const result of results) {
      if (!result.hitMine) continue;
      ctx.rooms.announce(
        room.roomId,
        `${result.username} hit a mine (${Math.round(result.risk * 100)}% risk) — ${result.points}`,
      );
    }

    if (isResolved(game.board)) {
      schedule(room.roomId, durations.reveal, () => endGame(room));
      return;
    }

    schedule(room.roomId, durations.reveal, () => beginRound(room));
  };

  const endGame = (room: MinesweeperRoom) => {
    clearRoundTimer(room.roomId);

    room.isGameStarted = false;
    room.game.round = 0;
    room.game.picks.clear();
    room.game.isRevealing = false;
    room.phaseEndsAt = 0;
    room.status = getRoomStatus(
      room.currentPlayerCount,
      room.maxPlayers,
      room.isGameStarted,
    );

    const ranked = Object.values(room.playerList).toSorted(
      (a, b) => b.points - a.points,
    );
    const winner = ranked[0];

    emitToRoom(io, room.roomId, 'ms:game:ended', toRoomState(room));
    ctx.rooms.announce(
      room.roomId,
      winner
        ? `Game over — ${winner.username} wins with ${winner.points} points!`
        : 'Game has ended!',
    );
    ctx.rooms.emitLobby('minesweeper');
  };

  /** Called after the seat is already gone from `playerList`. */
  const handlePlayerDeparture = (room: MinesweeperRoom, playerId: string) => {
    room.game.picks.delete(playerId);

    if (!room.isGameStarted) return;

    if (room.currentPlayerCount < MIN_PLAYERS_TO_START) {
      ctx.rooms.announce(
        room.roomId,
        'Not enough players left to continue. Game has ended.',
      );
      endGame(room);
      return;
    }

    // The round may have been waiting only on them.
    maybeResolveEarly(room);
  };

  /**
   * A connection dropped. There is no turn to hold here — the round belongs to
   * everybody — so the only thing to do is stop waiting for a player who cannot
   * answer. Their seat and score are held by the room layer as usual.
   */
  const handleDisconnect = (room: MinesweeperRoom) => {
    if (!room.isGameStarted) return;
    maybeResolveEarly(room);
  };

  const disposeRoom = (roomId: string) => clearRoundTimer(roomId);

  const dispose = () => {
    for (const roomId of new Set(roundTimers.keys())) clearRoundTimer(roomId);
  };

  return {
    startGame,
    pick,
    handlePlayerDeparture,
    handleDisconnect,
    disposeRoom,
    dispose,
    /** Exposed for tests: what the engine would pick for an absent player. */
    safestHiddenCell,
  };
};

type MinesweeperGameEngine = ReturnType<typeof createMinesweeperGameEngine>;

export { createMinesweeperGameEngine, MIN_PLAYERS_TO_START };
export type { MinesweeperGameEngine, MinesweeperRoom, MinesweeperSettings };
