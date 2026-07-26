import { randomUUID } from 'node:crypto';
import type {
  DrawAndGuessDetailRoomInfo,
  DrawAndGuessRoomState,
  LobbyRoomInfo,
  PlayerInfo,
  RoomStatus,
} from '../models/types.js';
import type { WordBank, WordCategory } from './word-bank.js';

const generateRoomId = (): string => {
  return randomUUID();
};

const getRandomInt = (min: number, max: number) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
};

const getRoomStatus = (
  currentSize: number,
  maxSize: number,
  isStarted: boolean = false,
): RoomStatus => {
  if (isStarted) {
    return 'In Progress';
  }

  return currentSize === maxSize ? 'Full' : 'Open';
};

/**
 * Builds the room summary shown in the lobby. This payload is broadcast to
 * every connected client, so it carries `hasPassword` rather than the password
 * itself — the frontend only ever used the field as a boolean to pick a lock
 * icon, while the raw value was readable by anyone who opened the lobby.
 */
const getDrawAndGuessLobbyRoomInfo = (
  drawAndGuessDetailRoomInfo: DrawAndGuessDetailRoomInfo,
): LobbyRoomInfo => {
  return {
    roomId: drawAndGuessDetailRoomInfo.roomId,
    roomName: drawAndGuessDetailRoomInfo.roomName,
    owner: drawAndGuessDetailRoomInfo.owner,
    status: drawAndGuessDetailRoomInfo.status,
    currentPlayerCount: drawAndGuessDetailRoomInfo.currentPlayerCount,
    maxPlayers: drawAndGuessDetailRoomInfo.maxPlayers,
    rounds: drawAndGuessDetailRoomInfo.rounds,
    hasPassword: drawAndGuessDetailRoomInfo.password !== '',
  };
};

/**
 * Builds the full room snapshot broadcast to the players inside a room.
 * Emitting the internal room object directly leaked the password, and — during
 * the drawing phase — the very word everyone else is supposed to be guessing.
 *
 * `currentWord` and `wordChoices` are drawer-private while the word is in play,
 * so they are omitted from the broadcast rather than blanked: the client merges
 * this snapshot over its existing state, and an omitted key leaves the drawer's
 * own copy intact. Both are delivered to the drawer alone, by
 * `drawerReceiveWordChoices` and `drawingPhaseStartedForDrawer`, and revealed to
 * the whole room by `reviewingPhaseStarted`.
 */
const getDrawAndGuessRoomState = (
  room: DrawAndGuessDetailRoomInfo,
): DrawAndGuessRoomState => {
  const isWordInPlay = room.isWordSelectingPhase || room.isDrawingPhase;

  const roomState: DrawAndGuessRoomState = {
    ...getDrawAndGuessLobbyRoomInfo(room),
    playerList: room.playerList,
    currentDrawer: room.currentDrawer,
    currentWordHint: room.currentWordHint,
    currentRound: room.currentRound,
    isGameStarted: room.isGameStarted,
    isWordSelectingPhase: room.isWordSelectingPhase,
    isDrawingPhase: room.isDrawingPhase,
    isReviewingPhase: room.isReviewingPhase,
    drawerQueue: [...room.drawerQueue],
    wordCategory: room.wordCategory,
    phaseEndsInMs: getRemainingPhaseMs(room),
  };

  if (!isWordInPlay) {
    roomState.currentWord = room.currentWord;
    roomState.wordChoices = room.wordChoices;
  }

  return roomState;
};

/**
 * Time left in the room's current phase. Sent to clients as a duration rather
 * than an absolute timestamp so that a client with a skewed clock still counts
 * down correctly — it anchors this against its own `Date.now()`.
 */
const getRemainingPhaseMs = (room: DrawAndGuessDetailRoomInfo): number => {
  return Math.max(0, room.phaseEndsAt - Date.now());
};

const getRandomCategory = (
  wordBank: WordBank,
): { name: WordCategory; words: string[] } => {
  const categoryList = Object.keys(wordBank) as WordCategory[];
  const randomCategoryIndex = getRandomInt(0, categoryList.length);
  const name = categoryList[randomCategoryIndex]!;

  return { name, words: wordBank[name] };
};

const getRandomChoicesFromList = (
  wordList: string[],
  numberOfChoices: number,
): string[] => {
  // Asking for more distinct choices than the list can supply would spin
  // forever, taking the whole server with it.
  const target = Math.min(numberOfChoices, wordList.length);
  const selectedIndexes = new Set<number>();

  while (selectedIndexes.size < target) {
    selectedIndexes.add(getRandomInt(0, wordList.length));
  }

  return [...selectedIndexes].map((index) => wordList[index]);
};

const getRandomElementFromSet = (set: Set<string>): string | undefined => {
  if (set.size === 0) return undefined;

  const randomIndex = getRandomInt(0, set.size);
  return [...set][randomIndex];
};

/**
 * The row of underscores everyone but the drawer sees, with `revealed`
 * character positions filled in.
 *
 * Spacing is kept as it is in the word, so "Ice Cream" hints as "___ _____"
 * and a two-word answer looks like one.
 */
const buildWordHint = (
  word: string,
  revealed?: ReadonlySet<number>,
): string => {
  return [...word]
    .map((character, index) => {
      if (/\s/.test(character)) return character;
      return revealed?.has(index) ? character : '_';
    })
    .join('');
};

/** The positions in a word that a hint could reveal — everything but spaces. */
const revealablePositions = (word: string): number[] => {
  return [...word].flatMap((character, index) =>
    /\s/.test(character) ? [] : [index],
  );
};

const resetPoints = (
  playerList: Record<string, PlayerInfo>,
): Record<string, PlayerInfo> => {
  return Object.fromEntries(
    Object.entries(playerList).map(([socketId, playerInfo]) => {
      return [
        socketId,
        {
          ...playerInfo,
          points: 0,
        },
      ];
    }),
  );
};

const resetReceivedPointsThisTurn = (
  playerList: Record<string, PlayerInfo>,
): Record<string, PlayerInfo> => {
  return Object.fromEntries(
    Object.entries(playerList).map(([socketId, playerInfo]) => {
      return [
        socketId,
        {
          ...playerInfo,
          receivedPointsThisTurn: false,
        },
      ];
    }),
  );
};

export {
  generateRoomId,
  getRandomInt,
  getRoomStatus,
  getDrawAndGuessLobbyRoomInfo,
  getDrawAndGuessRoomState,
  getRemainingPhaseMs,
  getRandomCategory,
  getRandomChoicesFromList,
  getRandomElementFromSet,
  buildWordHint,
  revealablePositions,
  resetPoints,
  resetReceivedPointsThisTurn,
};
