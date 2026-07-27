import type { DrawAndGuessState } from '../../models/types.js';
import type { CustomError, ErrorType } from '../../models/error.js';
import type { GameContext, Room } from '../../libs/rooms/types.js';
import { emitToPlayer, emitToRoom } from '../../libs/rooms/emit.js';
import {
  getRandomInt,
  getRandomElementFromSet,
  getRemainingPhaseMs,
  getRoomStatus,
  resetPoints,
} from '../../libs/utils.js';
import {
  buildWordHint,
  getRandomCategory,
  getRandomChoicesFromList,
  revealablePositions,
} from './words.js';
import {
  phaseDurationsInSeconds as defaultPhaseDurations,
  type PhaseDurationsInSeconds,
} from '../../libs/game-clock.js';
import { wordBank } from '../../libs/word-bank.js';
import { clearCanvas } from './canvas.js';
import { toRoomState } from './state.js';

const MIN_PLAYERS_TO_START = 2;
const WORD_CHOICE_COUNT = 3;

/**
 * How long a turn waits for a drawer whose connection dropped mid-drawing,
 * before giving up and moving on. A reload takes about a second; this is the
 * bound on how long everyone else stares at a frozen canvas if they were not
 * reloading but leaving.
 */
const DEFAULT_DRAWER_HOLD_SECONDS = 10;

/**
 * The hint gets easier as the clock runs down: two reveals, evenly spaced
 * through the drawing phase, uncovering up to a third of the letters between
 * them. A third is enough to rescue a stalled room without handing over a
 * short word — "Pear" gives up one letter, never two.
 */
const HINT_REVEAL_COUNT = 2;
const MAX_REVEALED_FRACTION = 1 / 3;

/**
 * A guess is worth what is left on the clock.
 *
 * Everyone used to score a flat 100 whether they got it in three seconds or in
 * the last one, which made a turn a pass/fail rather than a race. The floor is
 * for getting there at all; the bonus is for getting there first. The two add
 * up to an average of about the old 100, so scores across the two schemes are
 * still comparable.
 *
 * The drawer takes a cut of whatever the guesser earned, keeping the old 100/40
 * ratio — a drawing people get quickly is a better drawing.
 */
const GUESS_POINTS_FLOOR = 50;
const GUESS_POINTS_MAX_BONUS = 100;
const DRAWER_SHARE_OF_GUESS = 0.4;

const roomError = (message: string, errorType: ErrorType): CustomError => {
  const error = new Error(message) as CustomError;
  error.errorType = errorType;
  return error;
};

type DrawAndGuessRoom = Room<DrawAndGuessState>;

/**
 * Owns the turn state machine for Draw & Guess.
 *
 * The phase clock used to live in the drawer's browser: their tab emitted
 * `drawingPhaseTimerEnded` and `reviewingPhaseTimerEnded`, so closing it left
 * the room stuck forever, and a modified client could end — or never end — its
 * own turn. Here, the server holds one `setTimeout` per room and drives every
 * transition itself. Clients are told how many milliseconds remain and render a
 * countdown from that; nothing they send can advance a phase.
 *
 * One engine is created per server process and shared by all connections, so
 * the timer registries below are genuinely per-room rather than per-socket.
 * They are also *this game's*: the room layer owns exactly one kind of timer,
 * the seat expiry, and knows nothing about these three.
 *
 * The phase durations are a parameter rather than a module-level constant so a
 * test can drive a whole game in milliseconds. Production passes nothing and
 * gets the env-configured defaults.
 */
const createDrawAndGuessGameEngine = (
  ctx: GameContext,
  phaseDurationsInSeconds: PhaseDurationsInSeconds = defaultPhaseDurations,
) => {
  const { io, sessions } = ctx;
  const phaseTimers = new Map<string, NodeJS.Timeout>();
  /** How long a room is still waiting for a drawer who dropped, keyed by room. */
  const drawerHoldTimers = new Map<string, NodeJS.Timeout>();
  /** Pending letter reveals for the turn in progress, keyed by room. */
  const hintTimers = new Map<string, NodeJS.Timeout[]>();
  const drawerHoldInSeconds =
    phaseDurationsInSeconds.drawerHold ?? DEFAULT_DRAWER_HOLD_SECONDS;

  const roomOf = (roomId: string): DrawAndGuessRoom | undefined =>
    ctx.rooms.ofType<DrawAndGuessState>(roomId, 'draw-and-guess');

  const announce = (roomId: string, message: string) =>
    ctx.rooms.announce(roomId, message);

  const emitLobbyRoomList = () => ctx.rooms.emitLobby('draw-and-guess');

  const clearPhaseTimer = (roomId: string) => {
    const pending = phaseTimers.get(roomId);
    if (pending) {
      clearTimeout(pending);
      phaseTimers.delete(roomId);
    }
  };

  const clearDrawerHold = (roomId: string) => {
    const pending = drawerHoldTimers.get(roomId);
    if (pending) {
      clearTimeout(pending);
      drawerHoldTimers.delete(roomId);
    }
  };

  const clearHintTimers = (roomId: string) => {
    for (const timer of hintTimers.get(roomId) ?? []) clearTimeout(timer);
    hintTimers.delete(roomId);
  };

  /**
   * Uncovers letters of the word as the drawing phase runs down.
   *
   * The positions are drawn at random up front and then revealed in that order,
   * so a reveal cannot land on a letter that is already showing, and each step
   * genuinely tells the room something it did not know.
   */
  const scheduleHintReveals = (room: DrawAndGuessRoom) => {
    clearHintTimers(room.roomId);

    const positions = revealablePositions(room.game.currentWord);
    const totalToReveal = Math.floor(positions.length * MAX_REVEALED_FRACTION);
    if (totalToReveal === 0) return;

    // Fisher-Yates, so every letter is equally likely to be the one given away.
    const order = [...positions];
    for (let index = order.length - 1; index > 0; index--) {
      const swapWith = getRandomInt(0, index + 1);
      [order[index], order[swapWith]] = [order[swapWith], order[index]];
    }

    const word = room.game.currentWord;
    const revealed = new Set<number>();
    const timers: NodeJS.Timeout[] = [];

    // Counted here rather than off `revealed`, which is empty until the first
    // timer fires: a three-letter word has one letter to give away, and both
    // steps would otherwise be scheduled to reveal that same letter — the
    // second one an emit that changes nothing.
    let scheduledSoFar = 0;

    for (let step = 1; step <= HINT_REVEAL_COUNT; step++) {
      const revealedByNow = Math.round(
        (totalToReveal * step) / HINT_REVEAL_COUNT,
      );
      if (revealedByNow <= scheduledSoFar) continue;
      scheduledSoFar = revealedByNow;

      const upTo = revealedByNow;
      const delayInSeconds =
        (phaseDurationsInSeconds.drawing * step) / (HINT_REVEAL_COUNT + 1);

      timers.push(
        setTimeout(() => {
          const current = roomOf(room.roomId);
          // The turn may have ended early — everybody guessed, the drawer
          // dropped — and the next one is not this one's word to hint at.
          if (!current) return;
          if (!current.game.isDrawingPhase) return;
          if (current.game.currentWord !== word) return;

          for (const position of order.slice(0, upTo)) revealed.add(position);
          current.game.currentWordHint = buildWordHint(word, revealed);

          emitToRoom(io, current.roomId, 'dg:hint', {
            currentWordHint: current.game.currentWordHint,
          });
        }, delayInSeconds * 1000),
      );
    }

    hintTimers.set(room.roomId, timers);
  };

  const schedulePhaseEnd = (
    roomId: string,
    durationInSeconds: number,
    onPhaseEnd: () => void,
  ) => {
    clearPhaseTimer(roomId);
    phaseTimers.set(
      roomId,
      setTimeout(() => {
        phaseTimers.delete(roomId);
        // The room may have been emptied and deleted while we waited.
        if (roomOf(roomId)) onPhaseEnd();
      }, durationInSeconds * 1000),
    );
  };

  const startGame = (room: DrawAndGuessRoom, playerId: string) => {
    // The Start button has always been owner-only in the UI and nowhere else,
    // so any connected client could start any room's game with a room id off
    // the lobby broadcast. Checked before anything else about the room is
    // reported, so a stranger learns nothing from the reply either.
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

    room.playerList = resetPoints(room.playerList);
    room.game.currentRound = 0;
    room.isGameStarted = true;
    room.status = getRoomStatus(
      room.currentPlayerCount,
      room.maxPlayers,
      room.isGameStarted,
    );
    room.game.wordCategory = getRandomCategory(wordBank).name;

    // Logged without the room object, which carries the password
    console.log(
      `Game started in room ${room.roomId} with category "${room.game.wordCategory}".`,
    );

    emitToRoom(io, room.roomId, 'dg:game:started', {
      playerList: room.playerList,
      isGameStarted: room.isGameStarted,
      status: room.status,
      wordCategory: room.game.wordCategory,
    });
    announce(
      room.roomId,
      `Game has started! The word category for this game is "${room.game.wordCategory}"!`,
    );
    emitLobbyRoomList();

    startNewRound(room);
  };

  const startNewRound = (room: DrawAndGuessRoom) => {
    room.game.currentRound += 1;
    room.game.drawerQueue = new Set(Object.keys(room.playerList));

    emitToRoom(io, room.roomId, 'dg:round', {
      currentRound: room.game.currentRound,
      drawerQueue: [...room.game.drawerQueue],
    });

    startNewDrawerTurn(room);
  };

  const startNewDrawerTurn = (room: DrawAndGuessRoom) => {
    // The server's copy of the drawing is wiped exactly where every client
    // wipes theirs, which is what keeps the two the same thing.
    clearCanvas(room.game.canvas);
    emitToRoom(io, room.roomId, 'dg:canvas:clear');
    room.game.scoredThisTurn.clear();

    // Only somebody actually present can take a turn. A player inside their
    // reconnect grace period still holds a seat, but handing them the pencil
    // would stall the room until they either returned or timed out.
    const presentInQueue = new Set(
      [...room.game.drawerQueue].filter(
        (playerId) => room.playerList[playerId]?.isConnected,
      ),
    );

    const newDrawer = getRandomElementFromSet(presentInQueue);
    if (!newDrawer || room.game.wordCategory === '') {
      endGame(room);
      return;
    }

    room.game.currentDrawer = newDrawer;
    room.game.drawerQueue.delete(newDrawer);
    room.game.currentWord = '';
    room.game.currentWordHint = '';
    room.game.isWordSelectingPhase = true;
    room.game.isDrawingPhase = false;
    room.game.isReviewingPhase = false;
    room.game.wordChoices = getRandomChoicesFromList(
      wordBank[room.game.wordCategory],
      WORD_CHOICE_COUNT,
    );
    room.phaseEndsAt =
      Date.now() + phaseDurationsInSeconds.wordSelecting * 1000;

    emitToRoom(io, room.roomId, 'dg:phase:word-select', {
      playerList: room.playerList,
      currentDrawer: room.game.currentDrawer,
      drawerQueue: [...room.game.drawerQueue],
      scoredThisTurn: [...room.game.scoredThisTurn],
      isWordSelectingPhase: room.game.isWordSelectingPhase,
      phaseEndsInMs: getRemainingPhaseMs(room),
    });

    // Only the drawer learns what the choices are, and only over the socket
    // their identity is currently attached to.
    emitToPlayer(
      io,
      sessions,
      newDrawer,
      'dg:word-choices',
      room.game.wordChoices,
    );

    // Falling back to the first choice used to be the drawer's browser's
    // job, which meant it never happened if they had closed the tab.
    schedulePhaseEnd(room.roomId, phaseDurationsInSeconds.wordSelecting, () => {
      const fallbackWord = room.game.wordChoices[0];
      if (fallbackWord === undefined) {
        endTurn(room);
        return;
      }
      beginDrawingPhase(room, fallbackWord);
    });
  };

  const beginDrawingPhase = (room: DrawAndGuessRoom, word: string) => {
    room.game.currentWord = word;
    room.game.currentWordHint = buildWordHint(word);
    room.game.isWordSelectingPhase = false;
    room.game.isDrawingPhase = true;
    room.game.wordChoices = []; // Empty the word choices once one is picked
    room.phaseEndsAt = Date.now() + phaseDurationsInSeconds.drawing * 1000;

    console.log(
      `In room ${room.roomId}, drawer ${room.game.currentDrawer} is drawing "${word}".`,
    );

    emitToRoom(io, room.roomId, 'dg:phase:drawing', {
      currentWordHint: room.game.currentWordHint,
      isWordSelectingPhase: room.game.isWordSelectingPhase,
      isDrawingPhase: room.game.isDrawingPhase,
      wordChoices: room.game.wordChoices,
      phaseEndsInMs: getRemainingPhaseMs(room),
    });

    // Only the drawer is told the word itself.
    emitToPlayer(io, sessions, room.game.currentDrawer, 'dg:word', word);

    schedulePhaseEnd(room.roomId, phaseDurationsInSeconds.drawing, () =>
      beginReviewingPhase(room),
    );
    scheduleHintReveals(room);
  };

  const beginReviewingPhase = (room: DrawAndGuessRoom) => {
    // Nothing left to hint at: the next event reveals the word itself.
    clearHintTimers(room.roomId);

    room.game.isDrawingPhase = false;
    room.game.isReviewingPhase = true;
    room.phaseEndsAt = Date.now() + phaseDurationsInSeconds.reviewing * 1000;

    emitToRoom(io, room.roomId, 'dg:phase:review', {
      isDrawingPhase: room.game.isDrawingPhase,
      isReviewingPhase: room.game.isReviewingPhase,
      currentWord: room.game.currentWord,
      phaseEndsInMs: getRemainingPhaseMs(room),
    });

    schedulePhaseEnd(room.roomId, phaseDurationsInSeconds.reviewing, () =>
      endTurn(room),
    );
  };

  const endTurn = (room: DrawAndGuessRoom) => {
    clearPhaseTimer(room.roomId);
    clearDrawerHold(room.roomId);
    clearHintTimers(room.roomId);

    room.game.isWordSelectingPhase = false;
    room.game.isDrawingPhase = false;
    room.game.isReviewingPhase = false;
    room.game.currentDrawer = '';
    room.game.currentWord = '';
    room.game.currentWordHint = '';
    room.game.wordChoices = [];
    room.phaseEndsAt = 0;

    emitToRoom(io, room.roomId, 'dg:phase:idle', {
      isWordSelectingPhase: room.game.isWordSelectingPhase,
      isDrawingPhase: room.game.isDrawingPhase,
      isReviewingPhase: room.game.isReviewingPhase,
      currentDrawer: room.game.currentDrawer,
      currentWord: room.game.currentWord,
      currentWordHint: room.game.currentWordHint,
    });

    // A departure may have ended the game while this turn was running.
    if (!room.isGameStarted) return;

    if (room.game.drawerQueue.size > 0) {
      startNewDrawerTurn(room);
    } else if (room.game.currentRound < room.game.rounds) {
      startNewRound(room);
    } else {
      endGame(room);
    }
  };

  const endGame = (room: DrawAndGuessRoom) => {
    clearPhaseTimer(room.roomId);
    clearDrawerHold(room.roomId);
    clearHintTimers(room.roomId);

    room.game.currentRound = 0;
    room.isGameStarted = false;
    room.game.isWordSelectingPhase = false;
    room.game.isDrawingPhase = false;
    room.game.isReviewingPhase = false;
    room.game.currentDrawer = '';
    room.game.currentWord = '';
    room.game.currentWordHint = '';
    room.game.wordChoices = [];
    room.game.drawerQueue.clear();
    room.game.scoredThisTurn.clear();
    room.game.wordCategory = '';
    room.phaseEndsAt = 0;
    room.status = getRoomStatus(
      room.currentPlayerCount,
      room.maxPlayers,
      room.isGameStarted,
    );

    emitToRoom(io, room.roomId, 'dg:game:ended', toRoomState(room));
    announce(room.roomId, 'Game has ended!');
    emitLobbyRoomList();
  };

  /**
   * Called after a player has been removed from `playerList`, by either the
   * explicit leave handler or the disconnect handler.
   */
  const handlePlayerDeparture = (room: DrawAndGuessRoom, playerId: string) => {
    // Leaving a stale id in the queue would hand a turn to a player who is
    // no longer there, and nobody would ever draw it.
    room.game.drawerQueue.delete(playerId);
    room.game.scoredThisTurn.delete(playerId);

    if (!room.isGameStarted) return;

    if (room.currentPlayerCount < MIN_PLAYERS_TO_START) {
      announce(
        room.roomId,
        'Not enough players left to continue. Game has ended.',
      );
      endGame(room);
      return;
    }

    if (room.game.currentDrawer === playerId) {
      announce(
        room.roomId,
        'The drawer left the room. Skipping to the next turn.',
      );
      endTurn(room);
    }
  };

  /**
   * What a correct guess is worth at this moment, to the guesser and to the
   * drawer. Lives here because the engine is what knows both halves: how long
   * the phase is, and how much of it is left.
   */
  const pointsForCorrectGuess = (
    room: DrawAndGuessRoom,
  ): { guesser: number; drawer: number } => {
    const phaseInMs = phaseDurationsInSeconds.drawing * 1000;
    const fractionLeft =
      phaseInMs > 0
        ? Math.min(1, Math.max(0, getRemainingPhaseMs(room) / phaseInMs))
        : 0;

    const guesser =
      GUESS_POINTS_FLOOR + Math.round(GUESS_POINTS_MAX_BONUS * fractionLeft);

    return { guesser, drawer: Math.round(guesser * DRAWER_SHARE_OF_GUESS) };
  };

  /**
   * A guess has just been scored. If it was the last one anybody could make,
   * the turn is over.
   *
   * The rest of a drawing phase whose word everyone has already guessed is
   * dead time: the drawer has nothing left to draw for and every guesser is
   * watching a countdown for a word they know. Players who are inside their
   * reconnect grace do not hold it open — they cannot guess while they are
   * away, so waiting for them would cost the room the whole phase.
   */
  const handleCorrectGuess = (room: DrawAndGuessRoom) => {
    if (!room.game.isDrawingPhase) return;

    const stillGuessing = Object.entries(room.playerList).filter(
      ([playerId, player]) =>
        playerId !== room.game.currentDrawer &&
        player.isConnected &&
        !room.game.scoredThisTurn.has(playerId),
    );
    if (stillGuessing.length > 0) return;

    announce(room.roomId, 'Everybody guessed the word!');
    beginReviewingPhase(room);
  };

  /**
   * The drawer's connection dropped, but they keep their seat.
   *
   * This used to end the turn on the spot, and it had to: the canvas lived only
   * in the clients' memory, so even a drawer who came back a second later would
   * have found a blank board and nothing worth returning to. The drawing is on
   * the server now, so the turn is worth holding briefly — a reload takes about
   * a second, and it comes back to the same board with the same clock still
   * running.
   *
   * Briefly, though. Nothing has been invested in a turn whose word has not
   * been chosen yet, and an absent drawer will not be choosing one, so that
   * case is still skipped at once. A turn already under way waits, but only for
   * `drawerHoldInSeconds` — long enough for a refresh, short enough that a room
   * whose drawer has actually gone is not left staring at a frozen canvas.
   */
  const handleDrawerDisconnect = (room: DrawAndGuessRoom, playerId: string) => {
    if (!room.isGameStarted) return;
    if (room.game.currentDrawer !== playerId) return;

    if (room.game.isWordSelectingPhase) {
      announce(
        room.roomId,
        'The drawer lost connection. Skipping to the next turn.',
      );
      endTurn(room);
      return;
    }

    // The reveal needs nobody in particular; it runs itself out.
    if (!room.game.isDrawingPhase) return;

    // Never outlast the phase it is holding open.
    const holdInSeconds = Math.min(
      drawerHoldInSeconds,
      getRemainingPhaseMs(room) / 1000,
    );

    clearDrawerHold(room.roomId);
    drawerHoldTimers.set(
      room.roomId,
      setTimeout(() => {
        drawerHoldTimers.delete(room.roomId);

        // They may have come back, left properly, or had the turn end under
        // them in the time we spent waiting.
        const current = roomOf(room.roomId);
        if (!current) return;
        if (current.game.currentDrawer !== playerId) return;
        if (current.playerList[playerId]?.isConnected) return;

        announce(
          current.roomId,
          'The drawer did not come back. Skipping to the next turn.',
        );
        endTurn(current);
      }, holdInSeconds * 1000),
    );
  };

  /**
   * They came back inside the hold, so the turn is theirs again.
   *
   * What only the drawer knows — the word, the canvas — is not re-sent here:
   * this runs during the identity handshake, before the room page has mounted
   * and subscribed. The page asks for it, over `room:sync`.
   */
  const handleDrawerReturn = (room: DrawAndGuessRoom, playerId: string) => {
    if (room.game.currentDrawer !== playerId) return;
    if (!drawerHoldTimers.has(room.roomId)) return;

    clearDrawerHold(room.roomId);
    announce(room.roomId, 'The drawer is back. Carry on!');
  };

  /** Drops a room's pending timers when the room itself is deleted. */
  const disposeRoom = (roomId: string) => {
    clearPhaseTimer(roomId);
    clearDrawerHold(roomId);
    clearHintTimers(roomId);
  };

  /** Drops every room's timers, for a server that is closing. */
  const dispose = () => {
    for (const roomId of new Set([
      ...phaseTimers.keys(),
      ...drawerHoldTimers.keys(),
      ...hintTimers.keys(),
    ])) {
      disposeRoom(roomId);
    }
  };

  /**
   * The drawer's own word choice. Verified rather than trusted: the sender has
   * to be the current drawer, in their own selecting phase, choosing one of
   * the words they were actually offered.
   */
  const selectWord = (roomId: string, playerId: string, word: string) => {
    const room = roomOf(roomId);
    if (!room) return;
    if (room.game.currentDrawer !== playerId) return;
    if (!room.game.isWordSelectingPhase) return;
    if (!room.game.wordChoices.includes(word)) return;

    clearPhaseTimer(roomId);
    beginDrawingPhase(room, word);
  };

  return {
    startGame,
    selectWord,
    pointsForCorrectGuess,
    handleCorrectGuess,
    handlePlayerDeparture,
    handleDrawerDisconnect,
    handleDrawerReturn,
    disposeRoom,
    dispose,
  };
};

type DrawAndGuessGameEngine = ReturnType<typeof createDrawAndGuessGameEngine>;

export { createDrawAndGuessGameEngine, MIN_PLAYERS_TO_START };
export type { DrawAndGuessGameEngine, DrawAndGuessRoom };
