import type { HushDiscard } from '../../models/types.js';
import { RequestError } from '../../models/error.js';
import type { GameContext, Room } from '../../libs/rooms/types.js';
import { getRoomStatus, resetPoints } from '../../libs/utils.js';
import {
  hushDurationsInSeconds as defaultDurations,
  reconnectGraceInSeconds,
  type HushDurationsInSeconds,
} from '../../libs/game-clock.js';
import {
  deal,
  levelsFor,
  listOf,
  MIN_PLAYERS,
  START_LIVES,
} from '../../../shared/hush.js';
import type { HushState } from './state.js';

type HushRoom = Room<HushState>;

/** The phases a level is being played in: its hands are out, and it is hushed. */
const IN_LEVEL = new Set(['countdown', 'playing', 'mistake', 'paused']);

const cardsOf = (cards: readonly number[]): string => listOf(cards.map(String));

const nameOf = (room: HushRoom, playerId: string) =>
  room.playerList[playerId]?.username ?? 'A player';

const cardsLeft = (room: HushRoom) =>
  Object.values(room.game.hands).reduce((sum, hand) => sum + hand.length, 0);

/** Dropped players who still hold cards: the level cannot go on without them. */
const awayHolders = (room: HushRoom) =>
  Object.keys(room.playerList).filter(
    (playerId) =>
      !room.playerList[playerId].isConnected &&
      (room.game.hands[playerId]?.length ?? 0) > 0,
  );

/** Hushed while a level is played, for everybody. */
const mayChat = (room: HushRoom) => !IN_LEVEL.has(room.game.phase);

/**
 * Owns the level loop. Hush has no turns and, while a level is played, no
 * clock: anybody plays their lowest card at any moment, and the server decides
 * in arrival order whether it went over a card still held. Only the moments
 * around a level are timed, one timer a room.
 */
const createHushGameEngine = (
  ctx: GameContext,
  durations: HushDurationsInSeconds = defaultDurations,
  graceInSeconds: number = reconnectGraceInSeconds,
) => {
  const timers = new Map<string, NodeJS.Timeout>();

  const roomOf = (roomId: string): HushRoom | undefined =>
    ctx.rooms.ofType<HushState>(roomId, 'hush');

  const clearTimer = (roomId: string) => {
    const pending = timers.get(roomId);
    if (pending) {
      clearTimeout(pending);
      timers.delete(roomId);
    }
  };

  /** Starts a timed phase, `onDue` when it ends. */
  const timed = (
    room: HushRoom,
    seconds: number,
    onDue: (room: HushRoom) => void,
  ) => {
    clearTimer(room.roomId);
    room.phaseEndsAt = Date.now() + seconds * 1000;
    timers.set(
      room.roomId,
      setTimeout(() => {
        timers.delete(room.roomId);
        // The room may have been emptied and deleted while we waited.
        const current = roomOf(room.roomId);
        if (current?.isGameStarted) onDue(current);
      }, seconds * 1000),
    );
  };

  const startGame = (room: HushRoom, playerId: string) => {
    if (room.owner.playerId !== playerId) {
      throw new RequestError(
        'notRoomOwner',
        'Only the room owner can start the game.',
      );
    }
    if (room.isGameStarted) {
      throw new RequestError(
        'gameAlreadyStarted',
        'The game has already started.',
      );
    }
    if (room.currentPlayerCount < MIN_PLAYERS) {
      throw new RequestError(
        'notEnoughPlayers',
        `At least ${MIN_PLAYERS} players are required to start.`,
      );
    }

    const game = room.game;
    game.levels = levelsFor(room.currentPlayerCount);
    game.lives = START_LIVES;
    game.history = [];
    game.lastGame = null;
    room.playerList = resetPoints(room.playerList);
    room.isGameStarted = true;
    room.status = getRoomStatus(
      room.currentPlayerCount,
      room.maxPlayers,
      room.isGameStarted,
    );

    console.log(`Hush started in room ${room.roomId}, ${game.levels} levels.`);

    ctx.rooms.announce(
      room.roomId,
      'system',
      `Game has started! ${game.levels} levels and ${START_LIVES} lives. Not a word while a level is played.`,
    );
    ctx.rooms.emitLobby('hush');

    beginReady(room, 1);
  };

  /** Level `level` waits for everybody to be ready. Nobody holds cards yet. */
  const beginReady = (room: HushRoom, level: number) => {
    clearTimer(room.roomId);
    const game = room.game;
    game.phase = 'ready';
    game.level = level;
    game.ready = new Set();
    game.hands = {};
    game.pile = [];
    game.discards = [];
    game.livesLost = 0;
    game.lastMistake = null;
    game.lastLevel = null;
    room.phaseEndsAt = 0;
    ctx.rooms.emitState(room);
  };

  const ready = (roomId: string, playerId: string) => {
    const room = roomOf(roomId);
    if (!room?.isGameStarted || !room.playerList[playerId]) return;
    const game = room.game;
    if (game.phase !== 'ready' || game.ready.has(playerId)) return;

    game.ready.add(playerId);
    ctx.rooms.emitState(room);
    dealIfAllReady(room);
  };

  /** Every seated player is ready: deal, and count down to play. */
  const dealIfAllReady = (room: HushRoom) => {
    const game = room.game;
    const seated = Object.keys(room.playerList);
    if (!seated.every((playerId) => game.ready.has(playerId))) return;

    game.hands = deal(seated, game.level, Math.random);
    beginCountdown(room);
  };

  /**
   * Everybody's moment to start from, before play opens or opens again. A
   * level waits instead while somebody who holds cards is away.
   */
  const beginCountdown = (room: HushRoom) => {
    if (awayHolders(room).length > 0) {
      pause(room);
      return;
    }
    room.game.phase = 'countdown';
    timed(room, durations.countdown, (current) => {
      if (awayHolders(current).length > 0) {
        pause(current);
        return;
      }
      current.game.phase = 'playing';
      current.phaseEndsAt = 0;
      ctx.rooms.emitState(current);
    });
    ctx.rooms.emitState(room);
  };

  /** Waits for every dropped player who holds cards, until their seat goes. */
  const pause = (room: HushRoom) => {
    clearTimer(room.roomId);
    const game = room.game;
    game.phase = 'paused';
    room.phaseEndsAt = Math.max(
      0,
      ...awayHolders(room).map(
        (playerId) => game.seatEndsAt.get(playerId) ?? 0,
      ),
    );
    ctx.rooms.emitState(room);
  };

  /**
   * `playerId` plays `card`, which must still be their lowest: a play names
   * its card so that a double tap, or a card already discarded by a play that
   * arrived first, is not taken for the next one.
   */
  const play = (roomId: string, playerId: string, card: number) => {
    const room = roomOf(roomId);
    if (!room?.isGameStarted || !room.playerList[playerId]) return;
    const game = room.game;
    if (game.phase !== 'playing') return;
    const hand = game.hands[playerId];
    if (!hand || hand[0] !== card) return;

    hand.shift();
    game.pile.push({ card, playerId });

    // Every card under it, wherever it is, is a mistake's to discard.
    const under: HushDiscard[] = Object.entries(game.hands)
      .flatMap(([holder, cards]) =>
        cards
          .filter((held) => held < card)
          .map((held) => ({
            card: held,
            playerId: holder,
            reason: 'mistake' as const,
          })),
      )
      .toSorted((a, b) => a.card - b.card);

    if (under.length === 0) {
      if (cardsLeft(room) === 0) clearLevel(room);
      else ctx.rooms.emitState(room);
      return;
    }

    for (const [holder, cards] of Object.entries(game.hands)) {
      game.hands[holder] = cards.filter((held) => held > card);
    }
    game.discards = [...game.discards, ...under].toSorted(
      (a, b) => a.card - b.card,
    );
    game.lives -= 1;
    game.livesLost += 1;
    game.lastMistake = { playerId, card, discarded: under };

    const holders = [...new Set(under.map((discard) => discard.playerId))];
    const held = holders.map(
      (holder) =>
        `${nameOf(room, holder)} held ${cardsOf(
          under
            .filter((discard) => discard.playerId === holder)
            .map((discard) => discard.card),
        )}`,
    );
    ctx.rooms.announce(
      room.roomId,
      'alert',
      `${nameOf(room, playerId)} played ${card}, but ${listOf(held)}.`,
    );

    if (game.lives === 0) {
      endGame(room, { won: false, endedEarly: false });
      return;
    }
    game.phase = 'mistake';
    timed(room, durations.mistake, (current) => {
      current.game.lastMistake = null;
      if (cardsLeft(current) === 0) clearLevel(current);
      else goOn(current);
    });
    ctx.rooms.emitState(room);
  };

  /** Play goes on after a mistake: at once, or after a pause for the away. */
  const goOn = (room: HushRoom) => {
    if (awayHolders(room).length > 0) {
      pause(room);
      return;
    }
    room.game.phase = 'playing';
    room.phaseEndsAt = 0;
    ctx.rooms.emitState(room);
  };

  /** Every card is played or discarded. A level that cost no life wins one back. */
  const clearLevel = (room: HushRoom) => {
    clearTimer(room.roomId);
    const game = room.game;
    const clean = game.livesLost === 0;
    const lifeBack = clean && game.lives < START_LIVES;
    if (lifeBack) game.lives += 1;
    const record = {
      level: game.level,
      livesLost: game.livesLost,
      lifeBack,
      cleared: true,
    };
    game.history.push(record);
    for (const player of Object.values(room.playerList)) {
      player.points = game.history.length;
    }

    if (game.level === game.levels) {
      endGame(room, { won: true, endedEarly: false });
      return;
    }

    ctx.rooms.announce(
      room.roomId,
      'success',
      lifeBack
        ? `Level ${game.level} cleared without a slip: a life back!`
        : clean
          ? `Level ${game.level} cleared without a slip!`
          : `Level ${game.level} cleared!`,
    );
    game.phase = 'cleared';
    game.lastLevel = record;
    timed(room, durations.cleared, (current) =>
      beginReady(current, current.game.level + 1),
    );
    ctx.rooms.emitState(room);
  };

  /**
   * The team won, lost its last life, or is too few to go on. The last pile
   * stays on the table, and every card still held is shown.
   */
  const endGame = (
    room: HushRoom,
    { won, endedEarly }: { won: boolean; endedEarly: boolean },
  ) => {
    clearTimer(room.roomId);
    const game = room.game;
    // A level cut short goes into the record as not cleared; the last level,
    // just won, is in it already.
    if (IN_LEVEL.has(game.phase) && game.history.at(-1)?.level !== game.level) {
      game.history.push({
        level: game.level,
        livesLost: game.livesLost,
        lifeBack: false,
        cleared: false,
      });
    }
    const levelsCleared = game.history.filter(
      (record) => record.cleared,
    ).length;
    const standings = Object.entries(room.playerList).map(
      ([playerId, player]) => {
        player.points = levelsCleared;
        return { playerId, username: player.username, points: levelsCleared };
      },
    );
    const held = Object.entries(game.hands)
      .filter(
        ([playerId, cards]) => cards.length > 0 && room.playerList[playerId],
      )
      .map(([playerId, cards]) => ({ playerId, cards: [...cards] }));

    game.lastGame = {
      endedEarly,
      standings,
      levels: game.levels,
      levelsCleared,
      won,
      lives: game.lives,
      history: game.history,
      held,
    };

    const lostOn = game.level;
    room.isGameStarted = false;
    game.phase = 'waiting';
    game.level = 0;
    game.lives = START_LIVES;
    game.hands = {};
    game.ready = new Set();
    game.livesLost = 0;
    game.lastMistake = null;
    game.lastLevel = null;
    game.history = [];
    room.phaseEndsAt = 0;
    room.status = getRoomStatus(
      room.currentPlayerCount,
      room.maxPlayers,
      room.isGameStarted,
    );

    ctx.rooms.emitState(room);
    if (won) {
      ctx.rooms.announce(
        room.roomId,
        'success',
        `All ${game.lastGame.levels} levels cleared. Well played!`,
      );
    } else if (!endedEarly) {
      ctx.rooms.announce(
        room.roomId,
        'alert',
        `Out of lives on level ${lostOn}: ${levelsCleared} of ${game.lastGame.levels} levels cleared.`,
      );
    }
    ctx.rooms.emitLobby('hush');
  };

  /** The seat is held: a level waits for a player who still holds cards. */
  const handleDisconnect = (room: HushRoom, playerId: string) => {
    room.game.seatEndsAt.set(playerId, Date.now() + graceInSeconds * 1000);
    if (!room.isGameStarted) return;
    const { phase } = room.game;
    if (phase === 'paused') pause(room);
    else if (
      (phase === 'countdown' || phase === 'playing') &&
      awayHolders(room).includes(playerId)
    ) {
      pause(room);
    }
    // In a mistake, the pause starts when it ends; before a level or after
    // one, nobody holds cards.
  };

  /** Back in time: once nobody who holds cards is away, a countdown resumes. */
  const handleReturn = (room: HushRoom, playerId: string) => {
    room.game.seatEndsAt.delete(playerId);
    if (!room.isGameStarted || room.game.phase !== 'paused') return;
    if (awayHolders(room).length > 0) pause(room);
    else beginCountdown(room);
  };

  /**
   * Called after the seat is already gone from `playerList`. Their cards are
   * shown and discarded with no life lost: it was nobody's mistake.
   */
  const handlePlayerDeparture = (room: HushRoom, playerId: string) => {
    const game = room.game;
    game.seatEndsAt.delete(playerId);
    if (!room.isGameStarted) return;
    game.ready.delete(playerId);

    const cards = game.hands[playerId] ?? [];
    delete game.hands[playerId];
    if (cards.length > 0) {
      game.discards = [
        ...game.discards,
        ...cards.map((card) => ({ card, playerId, reason: 'left' as const })),
      ].toSorted((a, b) => a.card - b.card);
    }

    if (room.currentPlayerCount < MIN_PLAYERS) {
      ctx.rooms.announce(
        room.roomId,
        'alert',
        'Not enough players left to continue. Game has ended.',
      );
      endGame(room, { won: false, endedEarly: true });
      return;
    }

    if (cards.length > 0) {
      ctx.rooms.announce(
        room.roomId,
        'system',
        // The room has just said who left; their name is gone with the seat.
        `Their ${cardsOf(cards)} ${cards.length === 1 ? 'is' : 'are'} discarded, with no life lost.`,
      );
    }

    switch (game.phase) {
      case 'ready':
        dealIfAllReady(room);
        return;
      case 'countdown':
      case 'playing':
      case 'paused':
        if (cardsLeft(room) === 0) clearLevel(room);
        else if (cards.length > 0 || game.phase === 'paused') {
          beginCountdown(room);
        }
        return;
      default:
        // A mistake on show, or a cleared level, goes on by itself.
        return;
    }
  };

  const disposeRoom = (roomId: string) => clearTimer(roomId);

  const dispose = () => {
    for (const roomId of new Set(timers.keys())) clearTimer(roomId);
  };

  return {
    startGame,
    ready,
    play,
    mayChat,
    handleDisconnect,
    handleReturn,
    handlePlayerDeparture,
    disposeRoom,
    dispose,
  };
};

type HushGameEngine = ReturnType<typeof createHushGameEngine>;

export { createHushGameEngine };
export type { HushGameEngine, HushRoom };
