import type { GameType } from '../../../shared/wire-types';

/** What every page says about a game outside its room. */
export interface GameInfo {
  type: GameType;
  name: string;
  /** The game's surface colour on the home, games and rules pages. */
  tone: 'peach' | 'blue';
  /** One line on the game cards. */
  tagline: string;
  /** The game card's paper tag. */
  facts: string;
  /** The lobby's "How to play" card: a summary, then one fact per line. */
  lobbySummary: string;
  lobbyFacts: readonly string[];
  /** The rules page's full text; blank lines separate paragraphs. */
  rules: string;
  /** The create-room card's description. */
  createDescription: string;
  /** A game that can be played on your own, and its rules there. */
  solo?: { summary: string; facts: readonly string[] };
}

export const GAMES: readonly GameInfo[] = [
  {
    type: 'draw-and-guess',
    name: 'Draw & Guess',
    tone: 'peach',
    tagline: 'One draws. Everyone else tries to get there first.',
    facts: '2–8 players · 1–4 rounds',
    lobbySummary:
      'Take turns drawing a word while everyone else races to guess it in the chat. Faster guesses score more.',
    lobbyFacts: [
      '2–8 players',
      '1–4 rounds, everyone draws once a round',
      '15s to pick a word · 90s to draw',
      'The answer shows for 10s',
    ],
    rules: `2–8 players · 1–4 rounds

Everyone takes a turn to draw. One word category is used for the whole game, and everyone can see it.
The drawer has 15 seconds to pick one of 3 words. If time runs out, the first one is picked.

Everyone else has 90 seconds to type the word into the chat. Letters are revealed as the clock runs down. Once you get it, your chat locks until the next turn.

Faster guesses earn more, from 50 to 150 points, and the drawer gets two fifths of each. The answer is shown for 10 seconds, then the next turn starts.`,
    createDescription: 'Each round, everyone takes one turn to draw.',
  },
  {
    type: 'minesweeper',
    name: 'Minesweeper',
    tone: 'blue',
    tagline: 'Clear a board on your own, or share one and pick in secret.',
    facts: 'Solo or 2–8 players',
    lobbySummary:
      'Everyone picks a hidden cell at the same time. Riskier safe picks score more, and a mine costs points.',
    lobbyFacts: [
      '2–8 players',
      'Small, Medium or Large board',
      '15s to pick · 4s reveal',
      'Same safe cell? The points are split.',
    ],
    rules: `2–8 players · one shared board

Everyone picks one hidden cell at the same time. Your click locks your pick, and nobody sees which cell you chose.

You have 15 seconds to pick, then 4 seconds to see what everyone picked. A safe pick pays 10 points, plus more the riskier it was. A mine costs points, and costs more the safer the cell looked.

Pick the same safe cell as someone else? You split the reward. Run out of time? The safest cell is picked for you, without the 10-point base.

The board is Small, Medium or Large, chosen when the room is created. The game ends when the board is resolved or fewer than 2 players remain.

On your own, it is classic Minesweeper: open every safe cell without hitting a mine. Your first click is always safe. Right-click or long-press a cell to flag it, and click a number whose flags are all placed to open the rest around it. Your best time on each board is kept on this device.`,
    createDescription:
      'Pick a board. Small is a quick game; Large takes a while.',
    solo: {
      summary: 'Open every safe cell. The numbers count the mines next door.',
      facts: [
        'Your first click is always safe',
        'Right-click or long-press to flag; Flag mode makes a tap flag',
        'Click a number whose flags are placed to open the rest around it',
        'Your best time on each board is kept on this device',
      ],
    },
  },
];

export function gameInfo(type: GameType): GameInfo {
  const game = GAMES.find((candidate) => candidate.type === type);
  if (!game) throw new Error(`Unknown game ${type}`);
  return game;
}

export function isGameType(value: string | undefined): value is GameType {
  return GAMES.some((game) => game.type === value);
}

/** A game on your own; it needs no name. */
export const soloPath = (type: GameType) => `/games/${type}/solo`;

/** The game's room list. */
export const lobbyPath = (type: GameType) => `/games/${type}`;
export const createRoomPath = (type: GameType) => `/games/${type}/new`;
export const roomPath = (type: GameType, roomId: string) =>
  `/games/${type}/rooms/${roomId}`;
