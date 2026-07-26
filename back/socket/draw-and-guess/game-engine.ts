import type { Server } from 'socket.io';
import type { DrawAndGuessDetailRoomInfo } from '../../models/types.js';
import type { CustomError, ErrorType } from '../../models/error.js';
import {
  buildWordHint,
  revealablePositions,
  getRandomInt,
  getDrawAndGuessLobbyRoomInfo,
  getDrawAndGuessRoomState,
  getRandomCategory,
  getRandomChoicesFromList,
  getRandomElementFromSet,
  getRoomStatus,
  getRemainingPhaseMs,
  resetPoints,
  resetReceivedPointsThisTurn,
} from '../../libs/utils.js';
import {
  phaseDurationsInSeconds as defaultPhaseDurations,
  type PhaseDurationsInSeconds,
} from '../../libs/game-clock.js';
import type { PlayerSessionRegistry } from '../../libs/player-session.js';
import { wordBank } from '../../libs/word-bank.js';
import { clearCanvas } from './canvas.js';

const MIN_PLAYERS_TO_START = 2;
const WORD_CHOICE_COUNT = 3;
const SYSTEM = '📢 System';

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
 * the timer registry below is genuinely per-room rather than per-socket.
 *
 * The phase durations are a parameter rather than a module-level constant so a
 * test can drive a whole game in milliseconds. Production passes nothing and
 * gets the env-configured defaults.
 */
const createDrawAndGuessGameEngine = (
  io: Server,
  rooms: Record<string, DrawAndGuessDetailRoomInfo>,
  sessions: PlayerSessionRegistry,
  phaseDurationsInSeconds: PhaseDurationsInSeconds = defaultPhaseDurations,
) => {
  const phaseTimers = new Map<string, NodeJS.Timeout>();
  /** How long a room is still waiting for a drawer who dropped, keyed by room. */
  const drawerHoldTimers = new Map<string, NodeJS.Timeout>();
  /** Pending letter reveals for the turn in progress, keyed by room. */
  const hintTimers = new Map<string, NodeJS.Timeout[]>();
  const drawerHoldInSeconds =
    phaseDurationsInSeconds.drawerHold ?? DEFAULT_DRAWER_HOLD_SECONDS;

  /**
   * Sends to whichever socket a player is currently using. Room state is keyed
   * by player id now; socket.io still addresses sockets.
   */
  const emitToPlayer = (
    playerId: string,
    event: string,
    ...args: unknown[]
  ) => {
    const socketId = sessions.socketIdFor(playerId);
    if (socketId) io.to(socketId).emit(event, ...args);
  };

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
  const scheduleHintReveals = (room: DrawAndGuessDetailRoomInfo) => {
    clearHintTimers(room.roomId);

    const positions = revealablePositions(room.currentWord);
    const totalToReveal = Math.floor(positions.length * MAX_REVEALED_FRACTION);
    if (totalToReveal === 0) return;

    // Fisher-Yates, so every letter is equally likely to be the one given away.
    const order = [...positions];
    for (let index = order.length - 1; index > 0; index--) {
      const swapWith = getRandomInt(0, index + 1);
      [order[index], order[swapWith]] = [order[swapWith], order[index]];
    }

    const word = room.currentWord;
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
          const current = rooms[room.roomId];
          // The turn may have ended early — everybody guessed, the drawer
          // dropped — and the next one is not this one's word to hint at.
          if (!current) return;
          if (!current.isDrawingPhase) return;
          if (current.currentWord !== word) return;

          for (const position of order.slice(0, upTo)) revealed.add(position);
          current.currentWordHint = buildWordHint(word, revealed);

          io.to(current.roomId).emit('wordHintRevealed', {
            currentWordHint: current.currentWordHint,
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
        if (rooms[roomId]) onPhaseEnd();
      }, durationInSeconds * 1000),
    );
  };

  const emitLobbyRoomList = () => {
    io.emit(
      'updateDrawAndGuessLobbyRoomList',
      Object.values(rooms).map(getDrawAndGuessLobbyRoomInfo),
    );
  };

  const announce = (roomId: string, message: string) => {
    io.to(roomId).emit('receiveMessage', SYSTEM, message);
  };

  const startGame = (roomId: string, playerId: string) => {
    const room = rooms[roomId];

    if (!room) {
      throw roomError('Room does not exist.', 'roomNotExist');
    }
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
    room.currentRound = 0;
    room.isGameStarted = true;
    room.status = getRoomStatus(
      room.currentPlayerCount,
      room.maxPlayers,
      room.isGameStarted,
    );
    room.wordCategory = getRandomCategory(wordBank).name;

    // Logged without the room object, which carries the password
    console.log(
      `Game started in room ${roomId} with category "${room.wordCategory}".`,
    );

    io.to(roomId).emit('startDrawAndGuessGameSuccess', {
      playerList: room.playerList,
      isGameStarted: room.isGameStarted,
      status: room.status,
      wordCategory: room.wordCategory,
    });
    announce(
      roomId,
      `Game has started! The word category for this game is "${room.wordCategory}"!`,
    );
    emitLobbyRoomList();

    startNewRound(room);
  };

  const startNewRound = (room: DrawAndGuessDetailRoomInfo) => {
    room.currentRound += 1;
    room.drawerQueue = new Set(Object.keys(room.playerList));

    io.to(room.roomId).emit('startNewRoundSuccess', {
      currentRound: room.currentRound,
      drawerQueue: [...room.drawerQueue],
    });

    startNewDrawerTurn(room);
  };

  const startNewDrawerTurn = (room: DrawAndGuessDetailRoomInfo) => {
    // The server's copy of the drawing is wiped exactly where every client
    // wipes theirs, which is what keeps the two the same thing.
    clearCanvas(room.canvas);
    io.to(room.roomId).emit('drawerClear');
    room.playerList = resetReceivedPointsThisTurn(room.playerList);

    // Only somebody actually present can take a turn. A player inside their
    // reconnect grace period still holds a seat, but handing them the pencil
    // would stall the room until they either returned or timed out.
    const presentInQueue = new Set(
      [...room.drawerQueue].filter(
        (playerId) => room.playerList[playerId]?.isConnected,
      ),
    );

    const newDrawer = getRandomElementFromSet(presentInQueue);
    if (!newDrawer || room.wordCategory === '') {
      endGame(room);
      return;
    }

    room.currentDrawer = newDrawer;
    room.drawerQueue.delete(newDrawer);
    room.currentWord = '';
    room.currentWordHint = '';
    room.isWordSelectingPhase = true;
    room.isDrawingPhase = false;
    room.isReviewingPhase = false;
    room.wordChoices = getRandomChoicesFromList(
      wordBank[room.wordCategory],
      WORD_CHOICE_COUNT,
    );
    room.phaseEndsAt =
      Date.now() + phaseDurationsInSeconds.wordSelecting * 1000;

    io.to(room.roomId).emit('wordSelectingPhaseStarted', {
      playerList: room.playerList,
      currentDrawer: room.currentDrawer,
      drawerQueue: [...room.drawerQueue],
      isWordSelectingPhase: room.isWordSelectingPhase,
      phaseEndsInMs: getRemainingPhaseMs(room),
    });

    // Only the drawer learns what the choices are, and only over the socket
    // their identity is currently attached to.
    emitToPlayer(newDrawer, 'drawerReceiveWordChoices', room.wordChoices);

    // Falling back to the first choice used to be the drawer's browser's
    // job, which meant it never happened if they had closed the tab.
    schedulePhaseEnd(room.roomId, phaseDurationsInSeconds.wordSelecting, () => {
      const fallbackWord = room.wordChoices[0];
      if (fallbackWord === undefined) {
        endTurn(room);
        return;
      }
      beginDrawingPhase(room, fallbackWord);
    });
  };

  const beginDrawingPhase = (
    room: DrawAndGuessDetailRoomInfo,
    word: string,
  ) => {
    room.currentWord = word;
    room.currentWordHint = buildWordHint(word);
    room.isWordSelectingPhase = false;
    room.isDrawingPhase = true;
    room.wordChoices = []; // Empty the word choices once one is picked
    room.phaseEndsAt = Date.now() + phaseDurationsInSeconds.drawing * 1000;

    console.log(
      `In room ${room.roomId}, drawer ${room.currentDrawer} is drawing "${word}".`,
    );

    io.to(room.roomId).emit('drawingPhaseStarted', {
      currentWordHint: room.currentWordHint,
      isWordSelectingPhase: room.isWordSelectingPhase,
      isDrawingPhase: room.isDrawingPhase,
      wordChoices: room.wordChoices,
      phaseEndsInMs: getRemainingPhaseMs(room),
    });

    // Only the drawer is told the word itself.
    emitToPlayer(room.currentDrawer, 'drawingPhaseStartedForDrawer', word);

    schedulePhaseEnd(room.roomId, phaseDurationsInSeconds.drawing, () =>
      beginReviewingPhase(room),
    );
    scheduleHintReveals(room);
  };

  const beginReviewingPhase = (room: DrawAndGuessDetailRoomInfo) => {
    // Nothing left to hint at: the next event reveals the word itself.
    clearHintTimers(room.roomId);

    room.isDrawingPhase = false;
    room.isReviewingPhase = true;
    room.phaseEndsAt = Date.now() + phaseDurationsInSeconds.reviewing * 1000;

    io.to(room.roomId).emit('reviewingPhaseStarted', {
      isDrawingPhase: room.isDrawingPhase,
      isReviewingPhase: room.isReviewingPhase,
      currentWord: room.currentWord,
      phaseEndsInMs: getRemainingPhaseMs(room),
    });

    schedulePhaseEnd(room.roomId, phaseDurationsInSeconds.reviewing, () =>
      endTurn(room),
    );
  };

  const endTurn = (room: DrawAndGuessDetailRoomInfo) => {
    clearPhaseTimer(room.roomId);
    clearDrawerHold(room.roomId);
    clearHintTimers(room.roomId);

    room.isWordSelectingPhase = false;
    room.isDrawingPhase = false;
    room.isReviewingPhase = false;
    room.currentDrawer = '';
    room.currentWord = '';
    room.currentWordHint = '';
    room.wordChoices = [];
    room.phaseEndsAt = 0;

    io.to(room.roomId).emit('reviewingPhaseEnded', {
      isWordSelectingPhase: room.isWordSelectingPhase,
      isDrawingPhase: room.isDrawingPhase,
      isReviewingPhase: room.isReviewingPhase,
      currentDrawer: room.currentDrawer,
      currentWord: room.currentWord,
      currentWordHint: room.currentWordHint,
    });

    // A departure may have ended the game while this turn was running.
    if (!room.isGameStarted) return;

    if (room.drawerQueue.size > 0) {
      startNewDrawerTurn(room);
    } else if (room.currentRound < room.rounds) {
      startNewRound(room);
    } else {
      endGame(room);
    }
  };

  const endGame = (room: DrawAndGuessDetailRoomInfo) => {
    clearPhaseTimer(room.roomId);
    clearDrawerHold(room.roomId);
    clearHintTimers(room.roomId);

    room.currentRound = 0;
    room.isGameStarted = false;
    room.isWordSelectingPhase = false;
    room.isDrawingPhase = false;
    room.isReviewingPhase = false;
    room.currentDrawer = '';
    room.currentWord = '';
    room.currentWordHint = '';
    room.wordChoices = [];
    room.drawerQueue.clear();
    room.wordCategory = '';
    room.phaseEndsAt = 0;
    room.status = getRoomStatus(
      room.currentPlayerCount,
      room.maxPlayers,
      room.isGameStarted,
    );

    io.to(room.roomId).emit(
      'endDrawAndGuessGame',
      getDrawAndGuessRoomState(room),
    );
    announce(room.roomId, 'Game has ended!');
    emitLobbyRoomList();
  };

  /**
   * Called after a player has been removed from `playerList`, by either the
   * explicit leave handler or the disconnect handler.
   */
  const handlePlayerDeparture = (
    room: DrawAndGuessDetailRoomInfo,
    playerId: string,
  ) => {
    // Leaving a stale id in the queue would hand a turn to a player who is
    // no longer there, and nobody would ever draw it.
    room.drawerQueue.delete(playerId);

    if (!room.isGameStarted) return;

    if (room.currentPlayerCount < MIN_PLAYERS_TO_START) {
      announce(
        room.roomId,
        'Not enough players left to continue. Game has ended.',
      );
      endGame(room);
      return;
    }

    if (room.currentDrawer === playerId) {
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
    room: DrawAndGuessDetailRoomInfo,
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
  const handleCorrectGuess = (room: DrawAndGuessDetailRoomInfo) => {
    if (!room.isDrawingPhase) return;

    const stillGuessing = Object.entries(room.playerList).filter(
      ([playerId, player]) =>
        playerId !== room.currentDrawer &&
        player.isConnected &&
        !player.receivedPointsThisTurn,
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
  const handleDrawerDisconnect = (
    room: DrawAndGuessDetailRoomInfo,
    playerId: string,
  ) => {
    if (!room.isGameStarted) return;
    if (room.currentDrawer !== playerId) return;

    if (room.isWordSelectingPhase) {
      announce(
        room.roomId,
        'The drawer lost connection. Skipping to the next turn.',
      );
      endTurn(room);
      return;
    }

    // The reveal needs nobody in particular; it runs itself out.
    if (!room.isDrawingPhase) return;

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
        const current = rooms[room.roomId];
        if (!current) return;
        if (current.currentDrawer !== playerId) return;
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
   * and subscribed. The page asks for it, in `room-events-handler.ts`.
   */
  const handleDrawerReturn = (
    room: DrawAndGuessDetailRoomInfo,
    playerId: string,
  ) => {
    if (room.currentDrawer !== playerId) return;
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

  /**
   * The drawer's own word choice. Verified rather than trusted: the sender has
   * to be the current drawer, in their own selecting phase, choosing one of
   * the words they were actually offered.
   */
  const selectWord = (roomId: string, playerId: string, word: string) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.currentDrawer !== playerId) return;
    if (!room.isWordSelectingPhase) return;
    if (!room.wordChoices.includes(word)) return;

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
  };
};

type DrawAndGuessGameEngine = ReturnType<typeof createDrawAndGuessGameEngine>;

export { createDrawAndGuessGameEngine };
export type { DrawAndGuessGameEngine };
