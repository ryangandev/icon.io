import type { Server } from 'socket.io';
import type { DrawAndGuessDetailRoomInfo } from '../../models/types.js';
import type { CustomError, ErrorType } from '../../models/error.js';
import {
  convertStrToUnderscores,
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
import { wordBank } from '../../libs/word-bank.js';

const MIN_PLAYERS_TO_START = 2;
const WORD_CHOICE_COUNT = 3;
const SYSTEM = '📢 System';

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
  phaseDurationsInSeconds: PhaseDurationsInSeconds = defaultPhaseDurations,
) => {
  const phaseTimers = new Map<string, NodeJS.Timeout>();

  const clearPhaseTimer = (roomId: string) => {
    const pending = phaseTimers.get(roomId);
    if (pending) {
      clearTimeout(pending);
      phaseTimers.delete(roomId);
    }
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

  const startGame = (roomId: string) => {
    const room = rooms[roomId];

    if (!room) {
      throw roomError('Room does not exist.', 'roomNotExist');
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
    io.to(room.roomId).emit('drawerClear');
    room.playerList = resetReceivedPointsThisTurn(room.playerList);

    const newDrawer = getRandomElementFromSet(room.drawerQueue);
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

    // Only the drawer learns what the choices are.
    io.to(newDrawer).emit('drawerReceiveWordChoices', room.wordChoices);

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
    room.currentWordHint = convertStrToUnderscores(word);
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
    io.to(room.currentDrawer).emit('drawingPhaseStartedForDrawer', word);

    schedulePhaseEnd(room.roomId, phaseDurationsInSeconds.drawing, () =>
      beginReviewingPhase(room),
    );
  };

  const beginReviewingPhase = (room: DrawAndGuessDetailRoomInfo) => {
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
    socketId: string,
  ) => {
    // Leaving a stale id in the queue would hand a turn to a player who is
    // no longer there, and nobody would ever draw it.
    room.drawerQueue.delete(socketId);

    if (!room.isGameStarted) return;

    if (room.currentPlayerCount < MIN_PLAYERS_TO_START) {
      announce(
        room.roomId,
        'Not enough players left to continue. Game has ended.',
      );
      endGame(room);
      return;
    }

    if (room.currentDrawer === socketId) {
      announce(
        room.roomId,
        'The drawer left the room. Skipping to the next turn.',
      );
      endTurn(room);
    }
  };

  /** Drops a room's pending timer when the room itself is deleted. */
  const disposeRoom = (roomId: string) => {
    clearPhaseTimer(roomId);
  };

  /**
   * The drawer's own word choice. Verified rather than trusted: the sender has
   * to be the current drawer, in their own selecting phase, choosing one of
   * the words they were actually offered.
   */
  const selectWord = (roomId: string, socketId: string, word: string) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.currentDrawer !== socketId) return;
    if (!room.isWordSelectingPhase) return;
    if (!room.wordChoices.includes(word)) return;

    clearPhaseTimer(roomId);
    beginDrawingPhase(room, word);
  };

  return {
    startGame,
    selectWord,
    handlePlayerDeparture,
    disposeRoom,
  };
};

type DrawAndGuessGameEngine = ReturnType<typeof createDrawAndGuessGameEngine>;

export { createDrawAndGuessGameEngine };
export type { DrawAndGuessGameEngine };
