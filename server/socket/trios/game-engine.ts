import { RequestError } from '../../models/error.js';
import type { GameContext, Room } from '../../libs/rooms/types.js';
import {
  gameOverMessage,
  getRoomStatus,
  resetPoints,
} from '../../libs/utils.js';
import {
  triosDurationsInSeconds as defaultDurations,
  type TriosDurationsInSeconds,
} from '../../libs/game-clock.js';
import {
  dealTable,
  findTrios,
  isTrio,
  takeTrio,
} from '../../../shared/trios.js';
import { shuffle } from '../../../shared/pairs.js';
import { lockoutOf, type TriosState } from './state.js';

const MIN_PLAYERS_TO_START = 2;

type TriosRoom = Room<TriosState>;

/**
 * Owns the race for each table. There are no turns: every claim is judged
 * the moment it arrives, so the first trio to reach the server takes it. One
 * timer per room drives the table (a hint due, or a taken trio on show), and
 * one per locked-out player ends their lockout.
 */
const createTriosGameEngine = (
  ctx: GameContext,
  durations: TriosDurationsInSeconds = defaultDurations,
) => {
  const tableTimers = new Map<string, NodeJS.Timeout>();
  /** Room id, then player id. */
  const lockoutTimers = new Map<string, Map<string, NodeJS.Timeout>>();
  /**
   * The trio the hints point at, by place, shuffled, for each room whose
   * table has had its first hint.
   */
  const hintPlans = new Map<string, number[]>();

  const roomOf = (roomId: string): TriosRoom | undefined =>
    ctx.rooms.ofType<TriosState>(roomId, 'trios');

  const clearTableTimer = (roomId: string) => {
    const pending = tableTimers.get(roomId);
    if (pending) {
      clearTimeout(pending);
      tableTimers.delete(roomId);
    }
  };

  const schedule = (
    roomId: string,
    durationInSeconds: number,
    onDue: () => void,
  ) => {
    clearTableTimer(roomId);
    tableTimers.set(
      roomId,
      setTimeout(() => {
        tableTimers.delete(roomId);
        // The room may have been emptied and deleted while we waited.
        if (roomOf(roomId)) onDue();
      }, durationInSeconds * 1000),
    );
  };

  const clearLockout = (room: TriosRoom, playerId: string) => {
    const timers = lockoutTimers.get(room.roomId);
    const pending = timers?.get(playerId);
    if (pending) clearTimeout(pending);
    timers?.delete(playerId);
    room.game.lockouts.delete(playerId);
  };

  const clearLockouts = (roomId: string) => {
    for (const pending of lockoutTimers.get(roomId)?.values() ?? []) {
      clearTimeout(pending);
    }
    lockoutTimers.delete(roomId);
    roomOf(roomId)?.game.lockouts.clear();
  };

  const startGame = (room: TriosRoom, playerId: string) => {
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
    clearLockouts(room.roomId);
    game.deal = dealTable(Math.random);
    game.found = 0;
    game.lastTrio = null;
    game.lastGame = null;
    room.playerList = resetPoints(room.playerList);
    room.isGameStarted = true;
    room.status = getRoomStatus(
      room.currentPlayerCount,
      room.maxPlayers,
      room.isGameStarted,
    );

    console.log(`Trios started in room ${room.roomId}, ${game.trios} trios.`);

    ctx.rooms.announce(
      room.roomId,
      'system',
      `Game has started! ${game.trios} trios to find.`,
    );
    ctx.rooms.emitLobby('trios');
    beginFinding(room);
  };

  /** A table everybody looks at, with the clock running to its first hint. */
  const beginFinding = (room: TriosRoom) => {
    const game = room.game;
    game.phase = 'finding';
    game.hint = [];
    hintPlans.delete(room.roomId);
    room.phaseEndsAt = Date.now() + durations.hint * 1000;
    ctx.rooms.emitState(room);
    schedule(room.roomId, durations.hint, () => giveHint(room));
  };

  /**
   * Nobody has found a trio for a while: mark one card of a trio for
   * everybody, and the next time a second card of the same one.
   */
  const giveHint = (room: TriosRoom) => {
    const game = room.game;
    if (!room.isGameStarted || game.phase !== 'finding') return;

    let plan = hintPlans.get(room.roomId);
    if (!plan) {
      const trios = findTrios(game.deal.table);
      const trio = trios[Math.floor(Math.random() * trios.length)];
      plan = shuffle(trio, Math.random);
      hintPlans.set(room.roomId, plan);
    }
    game.hint = plan.slice(0, game.hint.length + 1);

    if (game.hint.length < 2) {
      room.phaseEndsAt = Date.now() + durations.hint * 1000;
      schedule(room.roomId, durations.hint, () => giveHint(room));
    } else {
      room.phaseEndsAt = 0;
    }
    ctx.rooms.emitState(room);
  };

  /**
   * `playerId` claims `cards` as a trio. Only during `finding`, and not while
   * locked out. A claim with a card no longer on the table lost a race and is
   * dropped; one on the table that is not a trio locks its player out.
   */
  const claim = (roomId: string, playerId: string, cards: number[]) => {
    const room = roomOf(roomId);
    if (!room?.isGameStarted) return;

    const game = room.game;
    const player = room.playerList[playerId];
    if (!player || game.phase !== 'finding') return;
    if (lockoutOf(game, playerId)) return;
    if (new Set(cards).size !== cards.length) return;

    const places = cards.map((card) => game.deal.table.indexOf(card));
    if (places.includes(-1)) return;

    if (!isTrio(cards[0], cards[1], cards[2])) {
      lockOut(room, playerId, cards);
      return;
    }

    const inOrder = places.toSorted((a, b) => a - b);
    player.points += 1;
    game.found += 1;
    game.lastTrio = {
      playerId,
      username: player.username,
      cards: inOrder.map((place) => game.deal.table[place]),
      places: inOrder,
    };
    game.hint = [];
    hintPlans.delete(room.roomId);
    game.phase = 'taken';
    room.phaseEndsAt = Date.now() + durations.taken * 1000;

    ctx.rooms.announce(
      room.roomId,
      'success',
      `${player.username} found a trio! (+1)`,
    );
    ctx.rooms.emitState(room);
    schedule(room.roomId, durations.taken, () => refill(room, inOrder));
  };

  const lockOut = (room: TriosRoom, playerId: string, cards: number[]) => {
    clearLockout(room, playerId);
    room.game.lockouts.set(playerId, {
      endsAt: Date.now() + durations.lockout * 1000,
      cards: [...cards],
    });

    let timers = lockoutTimers.get(room.roomId);
    if (!timers) {
      timers = new Map();
      lockoutTimers.set(room.roomId, timers);
    }
    timers.set(
      playerId,
      setTimeout(() => {
        const current = roomOf(room.roomId);
        if (!current) return;
        clearLockout(current, playerId);
        ctx.rooms.emitState(current);
      }, durations.lockout * 1000),
    );

    ctx.rooms.emitState(room);
  };

  /** After a taken trio's pause: new cards in its places, or the end. */
  const refill = (room: TriosRoom, places: number[]) => {
    if (!room.isGameStarted) return;
    const game = room.game;
    if (game.found >= game.trios) {
      endGame(room, { endedEarly: false });
      return;
    }

    const next = takeTrio(game.deal, places, Math.random);
    if (!next) {
      // The table and the deck have no trio left between them.
      endGame(room, { endedEarly: false });
      return;
    }
    game.deal = next;
    beginFinding(room);
  };

  /** The last summary and table stay, for the results screen and a refresh. */
  const endGame = (
    room: TriosRoom,
    { endedEarly }: { endedEarly: boolean },
  ) => {
    clearTableTimer(room.roomId);
    clearLockouts(room.roomId);
    hintPlans.delete(room.roomId);
    const game = room.game;

    const standings = Object.entries(room.playerList)
      .map(([playerId, player]) => ({
        playerId,
        username: player.username,
        points: player.points,
      }))
      .toSorted((a, b) => b.points - a.points);

    game.lastGame = {
      endedEarly,
      standings,
      trios: game.trios,
      found: game.found,
    };

    room.isGameStarted = false;
    game.phase = 'waiting';
    game.hint = [];
    room.phaseEndsAt = 0;
    room.status = getRoomStatus(
      room.currentPlayerCount,
      room.maxPlayers,
      room.isGameStarted,
    );

    ctx.rooms.emitState(room);
    ctx.rooms.announce(
      room.roomId,
      'system',
      gameOverMessage(standings, 'trio'),
    );
    ctx.rooms.emitLobby('trios');
  };

  /** Called after the seat is already gone from `playerList`. */
  const handlePlayerDeparture = (room: TriosRoom, playerId: string) => {
    clearLockout(room, playerId);
    if (!room.isGameStarted) return;

    if (room.currentPlayerCount < MIN_PLAYERS_TO_START) {
      ctx.rooms.announce(
        room.roomId,
        'alert',
        'Not enough players left to continue. Game has ended.',
      );
      endGame(room, { endedEarly: true });
    }
  };

  const disposeRoom = (roomId: string) => {
    clearTableTimer(roomId);
    clearLockouts(roomId);
    hintPlans.delete(roomId);
  };

  const dispose = () => {
    for (const roomId of new Set(tableTimers.keys())) clearTableTimer(roomId);
    for (const roomId of new Set(lockoutTimers.keys())) clearLockouts(roomId);
    hintPlans.clear();
  };

  return {
    startGame,
    claim,
    handlePlayerDeparture,
    disposeRoom,
    dispose,
  };
};

type TriosGameEngine = ReturnType<typeof createTriosGameEngine>;

export { createTriosGameEngine, MIN_PLAYERS_TO_START };
export type { TriosGameEngine, TriosRoom };
