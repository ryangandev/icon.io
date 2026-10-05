import { randomInt } from 'node:crypto';
import type {
  LiarsDiceSettings,
  LiarsDiceStanding,
} from '../../models/types.js';
import { RequestError } from '../../models/error.js';
import type { GameContext } from '../../libs/rooms/types.js';
import { getRoomStatus } from '../../libs/utils.js';
import {
  liarsDiceDurationsInSeconds as defaultDurations,
  type LiarsDiceDurationsInSeconds,
} from '../../libs/game-clock.js';
import {
  bidStands,
  bidWords,
  countFace,
  isRaise,
  numberWord,
  OPENING_BID,
  rollDice,
  type Bid,
} from '../../../shared/liars-dice.js';
import { shuffle } from '../../../shared/pairs.js';
import {
  diceOnTable,
  isIn,
  playerAfter,
  playersIn,
  type LiarsDiceRoom,
} from './state.js';

const MIN_PLAYERS_TO_START = 2;
/** Sorts a player who kept dice after everybody who went out. */
const STILL_IN = Number.MAX_SAFE_INTEGER;

/**
 * Dice are rolled from the operating system's generator rather than
 * `Math.random`, whose state can in principle be worked out from enough of
 * its outputs, and every player sees some of them: their own dice.
 */
const secureRandom = (): number => randomInt(0, 2 ** 32) / 2 ** 32;

const diceWord = (count: number) => (count === 1 ? 'die' : 'dice');

/**
 * Owns the round loop. One player at a time raises the bid or calls Liar; a
 * call opens every cup for the reveal, somebody loses a die, and the loser
 * opens the next round, until one player has dice left.
 */
const createLiarsDiceGameEngine = (
  ctx: GameContext,
  durations: LiarsDiceDurationsInSeconds = defaultDurations,
  random: () => number = secureRandom,
) => {
  /** One per room: the open turn, or a reveal on show. */
  const timers = new Map<string, NodeJS.Timeout>();

  const roomOf = (roomId: string): LiarsDiceRoom | undefined =>
    ctx.rooms.ofType(roomId, 'liars-dice');

  const clearTimer = (roomId: string) => {
    const pending = timers.get(roomId);
    if (pending) {
      clearTimeout(pending);
      timers.delete(roomId);
    }
  };

  const schedule = (
    roomId: string,
    durationInSeconds: number,
    onDue: () => void,
  ) => {
    clearTimer(roomId);
    timers.set(
      roomId,
      setTimeout(() => {
        timers.delete(roomId);
        // The room may have been emptied and deleted while we waited.
        if (roomOf(roomId)) onDue();
      }, durationInSeconds * 1000),
    );
  };

  const nameOf = (room: LiarsDiceRoom, playerId: string) =>
    room.playerList[playerId]?.username ?? 'Somebody';

  const startGame = (room: LiarsDiceRoom, playerId: string) => {
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
    if (room.currentPlayerCount < MIN_PLAYERS_TO_START) {
      throw new RequestError(
        'notEnoughPlayers',
        `At least ${MIN_PLAYERS_TO_START} players are required to start.`,
      );
    }

    const game = room.game;
    game.order = shuffle(Object.keys(room.playerList), random);
    game.round = 0;
    game.dice = {};
    game.outs = [];
    game.lastGame = null;
    for (const player of Object.values(room.playerList)) {
      player.points = game.dicePerPlayer;
    }
    room.isGameStarted = true;
    room.status = getRoomStatus(
      room.currentPlayerCount,
      room.maxPlayers,
      room.isGameStarted,
    );

    console.log(
      `Liar's Dice started in room ${room.roomId}, ${game.dicePerPlayer} dice each.`,
    );

    ctx.rooms.announce(
      room.roomId,
      'system',
      `Game has started! ${game.dicePerPlayer} dice each, ${durations.turn} seconds a turn.`,
    );
    ctx.rooms.emitLobby('liars-dice');

    beginRound(room, game.order[0], { next: true });
  };

  /**
   * Everybody still in rolls, and `starter` opens. A round called off because
   * somebody left is rolled again under the same number.
   */
  const beginRound = (
    room: LiarsDiceRoom,
    starter: string,
    { next }: { next: boolean },
  ) => {
    const game = room.game;
    if (next) game.round += 1;
    game.dice = Object.fromEntries(
      playersIn(room).map((playerId) => [
        playerId,
        rollDice(room.playerList[playerId].points, random),
      ]),
    );
    game.bids = [];
    game.reveal = null;
    game.phase = 'bidding';
    beginTurn(room, starter);
  };

  /** `playerId` raises or calls, with a fresh clock. */
  const beginTurn = (room: LiarsDiceRoom, playerId: string) => {
    room.game.turnPlayerId = playerId;
    room.phaseEndsAt = Date.now() + durations.turn * 1000;
    ctx.rooms.emitState(room);
    schedule(room.roomId, durations.turn, () => runOutOfTime(room));
  };

  /**
   * Out of time, connected or not: Liar on the bid in front of them, or with
   * no bid yet the lowest bid. A call rather than the smallest raise, so the
   * risk stays with whoever ran out and a room is never held up by somebody
   * who has gone.
   */
  const runOutOfTime = (room: LiarsDiceRoom) => {
    const game = room.game;
    const playerId = game.turnPlayerId;
    if (!room.isGameStarted || game.phase !== 'bidding' || !playerId) return;

    const name = nameOf(room, playerId);
    if (game.bids.length === 0) {
      ctx.rooms.announce(
        room.roomId,
        'system',
        `${name} ran out of time, so ${bidWords(OPENING_BID)} is bid for them.`,
      );
      placeBid(room, playerId, OPENING_BID);
      return;
    }
    ctx.rooms.announce(
      room.roomId,
      'system',
      `${name} ran out of time, so Liar is called for them.`,
    );
    settleCall(room, playerId);
  };

  const isTurnOf = (room: LiarsDiceRoom, playerId: string) =>
    room.isGameStarted &&
    room.game.phase === 'bidding' &&
    room.game.turnPlayerId === playerId;

  /** A raise, on your turn; anything that is not a raise is ignored. */
  const bid = (
    roomId: string,
    playerId: string,
    count: number,
    face: number,
  ) => {
    const room = roomOf(roomId);
    if (!room || !isTurnOf(room, playerId)) return;
    const previous = room.game.bids.at(-1) ?? null;
    if (!isRaise({ count, face }, previous, diceOnTable(room))) return;
    placeBid(room, playerId, { count, face });
  };

  const placeBid = (
    room: LiarsDiceRoom,
    playerId: string,
    { count, face }: Bid,
  ) => {
    room.game.bids.push({ playerId, count, face });
    const next = playerAfter(room, playerId);
    if (next === null) return;
    beginTurn(room, next);
  };

  /** Liar, on your turn, on the bid in front of you. */
  const call = (roomId: string, playerId: string) => {
    const room = roomOf(roomId);
    if (!room || !isTurnOf(room, playerId)) return;
    if (room.game.bids.length === 0) return;
    settleCall(room, playerId);
  };

  /** Every cup opens, the bid is counted, and somebody loses a die. */
  const settleCall = (room: LiarsDiceRoom, callerId: string) => {
    const game = room.game;
    const called = game.bids.at(-1)!;
    const count = countFace(
      playersIn(room).map((playerId) => game.dice[playerId] ?? []),
      called.face,
    );
    const stands = bidStands(called, count);
    const loserId = stands ? callerId : called.playerId;
    const loser = room.playerList[loserId];
    loser.points -= 1;
    const out = loser.points === 0;
    if (out) game.outs.push({ playerId: loserId, round: game.round });

    game.reveal = {
      bid: { ...called },
      callerId,
      matched: count.matched,
      wild: count.wild,
      loserId,
      out,
    };
    game.phase = 'reveal';
    game.turnPlayerId = null;

    const there =
      count.matched === 1
        ? 'there was one'
        : `there were ${numberWord(count.matched)}`;
    ctx.rooms.announce(
      room.roomId,
      'system',
      `${nameOf(room, callerId)} called Liar on ${bidWords(called)}: ${there}. ${loser.username} loses a die.`,
    );
    if (out) {
      ctx.rooms.announce(room.roomId, 'alert', `${loser.username} is out.`);
    }

    // The game is over the moment one player has dice left; the reveal stays
    // on the table under the results.
    if (playersIn(room).length <= 1) {
      endGame(room, { endedEarly: false });
      return;
    }

    room.phaseEndsAt = Date.now() + durations.reveal * 1000;
    ctx.rooms.emitState(room);
    schedule(room.roomId, durations.reveal, () => afterReveal(room));
  };

  /** The loser opens the next round, or the next player still in if they are out. */
  const afterReveal = (room: LiarsDiceRoom) => {
    const game = room.game;
    if (!room.isGameStarted || game.phase !== 'reveal' || !game.reveal) return;
    const { loserId } = game.reveal;
    const starter = isIn(room, loserId) ? loserId : playerAfter(room, loserId);
    if (starter === null) return;
    beginRound(room, starter, { next: true });
  };

  /**
   * Winner first, then everybody else by how long they lasted. Ended early,
   * those left are placed by the dice they hold.
   */
  const standingsOf = (room: LiarsDiceRoom): LiarsDiceStanding[] => {
    const outRound = new Map(
      room.game.outs.map(({ playerId, round }) => [playerId, round]),
    );
    return Object.entries(room.playerList)
      .map(([playerId, player]) => ({
        playerId,
        username: player.username,
        points: player.points,
        outInRound: outRound.get(playerId) ?? null,
      }))
      .toSorted(
        (a, b) =>
          b.points - a.points ||
          (b.outInRound ?? STILL_IN) - (a.outInRound ?? STILL_IN),
      );
  };

  /** The last summary stays, for the results screen and a refresh. */
  const endGame = (
    room: LiarsDiceRoom,
    { endedEarly }: { endedEarly: boolean },
  ) => {
    clearTimer(room.roomId);
    const game = room.game;
    const standings = standingsOf(room);

    game.lastGame = {
      endedEarly,
      standings,
      dicePerPlayer: game.dicePerPlayer,
      rounds: game.round,
    };

    room.isGameStarted = false;
    game.phase = 'waiting';
    game.bids = [];
    game.turnPlayerId = null;
    room.phaseEndsAt = 0;
    room.status = getRoomStatus(
      room.currentPlayerCount,
      room.maxPlayers,
      room.isGameStarted,
    );

    ctx.rooms.emitState(room);
    const [winner] = standings;
    if (winner && winner.points > 0) {
      ctx.rooms.announce(
        room.roomId,
        'system',
        `Game over: ${winner.username} wins with ${winner.points} ${diceWord(winner.points)} left!`,
      );
    }
    ctx.rooms.emitLobby('liars-dice');
  };

  /** Called after the seat is already gone from `playerList`. */
  const handlePlayerDeparture = (room: LiarsDiceRoom, playerId: string) => {
    if (!room.isGameStarted) return;
    const game = room.game;

    if (room.currentPlayerCount < MIN_PLAYERS_TO_START) {
      ctx.rooms.announce(
        room.roomId,
        'alert',
        'Not enough players left to continue. Game has ended.',
      );
      endGame(room, { endedEarly: true });
      return;
    }

    // Their dice leave the table with them.
    delete game.dice[playerId];
    if (playersIn(room).length <= 1) {
      endGame(room, { endedEarly: false });
      return;
    }

    // The bids were about dice that are no longer there: the round is called
    // off, everybody still in rolls again, and whoever's turn it was opens.
    // A reveal stands, and the next round starts as usual without them.
    if (game.phase === 'bidding') {
      const turn = game.turnPlayerId;
      const starter =
        turn !== null && turn !== playerId && isIn(room, turn)
          ? turn
          : playerAfter(room, turn ?? playerId);
      if (starter === null) return;
      ctx.rooms.announce(
        room.roomId,
        'system',
        'A player left, so everybody rolls again.',
      );
      beginRound(room, starter, { next: false });
    }
  };

  const disposeRoom = (roomId: string) => clearTimer(roomId);

  const dispose = () => {
    for (const roomId of new Set(timers.keys())) clearTimer(roomId);
  };

  return {
    startGame,
    bid,
    call,
    handlePlayerDeparture,
    disposeRoom,
    dispose,
  };
};

type LiarsDiceGameEngine = ReturnType<typeof createLiarsDiceGameEngine>;

export { createLiarsDiceGameEngine, MIN_PLAYERS_TO_START };
export type { LiarsDiceGameEngine, LiarsDiceRoom, LiarsDiceSettings };
