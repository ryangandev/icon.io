import type { GameType } from '../../../shared/wire-types';
import { plural } from './plural';

/** What every page says about a game outside its room. */
export interface GameInfo {
  type: GameType;
  name: string;
  /** The game's surface colour on the home, games and rules pages. */
  tone: 'peach' | 'blue' | 'lime' | 'sand';
  /** One line on the game cards. */
  tagline: string;
  /** A shorter one for a phone's narrower card. */
  phoneTagline?: string;
  /** The game card's paper tag. */
  facts: string;
  /** The most seats a room may have; every game needs two to start. */
  maxPlayers: number;
  /** What a score counts, when it is not points: one, and many when not one plus "s". */
  scoreUnit?: string | readonly [one: string, many: string];
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
    maxPlayers: 8,
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
    maxPlayers: 8,
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
  {
    type: 'make-24',
    name: 'Make 24',
    tone: 'lime',
    tagline:
      'Four numbers. Plus, minus, times, divide. Make 24 before anyone else.',
    phoneTagline: 'Four numbers. Plus, minus, times, divide. Make 24.',
    facts: 'Solo or 2–8 players',
    maxPlayers: 8,
    lobbySummary:
      'Everyone gets the same four numbers at once. Use each one once, with plus, minus, times and divide, to make 24. Quicker answers score more.',
    lobbyFacts: [
      '2–8 players',
      '5 or 10 hands',
      '60s to solve each hand',
      'Others see that you solved it, never how',
    ],
    rules: `2–8 players · 5 or 10 hands

Every hand is four numbers from 1 to 13, and every hand can be solved. Use each number once, with plus, minus, times and divide, to make 24.

Pick a number, a sign, then another number: the two become one new card. Keep going until one card is left. Undo and Start over are free.

Everyone gets the same hand at the same time, with 60 seconds to solve it. Solving it pays 50 points, plus up to 100 more for the time left. Others see that you solved it, never how, and your chat waits until the hand ends.

On your own, a run is ten hands against one clock. Skip a hand you are stuck on, and 30 seconds go on the clock. Your best time is kept on this device, and Challenge a friend sends them the same ten hands.`,
    createDescription: 'Every hand is 60 seconds. Five hands is a quick game.',
    solo: {
      summary:
        'Four numbers, four signs, one target. Every hand can be solved.',
      facts: [
        'Ten hands against one clock',
        'Use each number once: pick a number, a sign and another number',
        'Stuck? Skip the hand for 30 seconds on the clock',
        'Your best time is kept on this device',
      ],
    },
  },
  {
    type: 'pairs',
    name: 'Pairs',
    tone: 'sand',
    tagline: 'Flip two cards. Remember where everything is. Find every pair.',
    facts: 'Solo or 2–6 players',
    maxPlayers: 6,
    scoreUnit: 'pair',
    lobbySummary:
      'Take turns flipping two cards. Find a pair and it is yours, and you go again. Whoever finds the most pairs wins.',
    lobbyFacts: [
      '2–6 players',
      'Small 4 × 4 or Large 6 × 6 board',
      '10s to flip two cards',
      'Everyone sees every card you flip',
    ],
    rules: `2–6 players · a Small or Large board

Every card lies face down, and every symbol is on two of them. Players take turns, in an order drawn at the start.

On your turn you have 10 seconds to flip two cards. If they match, the pair is yours and you go again. If not, everyone sees both for 2 seconds, then they flip back and the next player goes.

Run out of time and a card you flipped alone flips back. A player who is away when their turn comes is skipped. When every pair is found, whoever found the most wins.

On your own, clear the board in as few turns as you can; your time breaks a tie. Two cards that do not match flip back after a second. Your best on each board is kept on this device, and Challenge a friend sends them the same deck.`,
    createDescription:
      'Take turns flipping two cards. Small is a quick game; Large takes a while.',
    solo: {
      summary: 'Flip two cards at a time. Remember where everything is.',
      facts: [
        'A Small 4 × 4 or a Large 6 × 6 board',
        'Two cards that do not match flip back after a second',
        'Fewer turns is better; your time breaks a tie',
        'Your best on each board is kept on this device',
      ],
    },
  },
  {
    type: 'liars-dice',
    name: 'Liar’s Dice',
    tone: 'lime',
    tagline: 'Roll in secret. Bid on the whole table. Call the bluff.',
    phoneTagline: 'Roll in secret. Bid. Call the bluff.',
    facts: 'Solo or 2–6 players',
    maxPlayers: 6,
    scoreUnit: ['die', 'dice'],
    lobbySummary:
      'Everybody rolls dice nobody else can see, then bids on what the whole table holds. Call Liar on a bid you doubt: whoever was wrong loses a die. The last player with dice wins.',
    lobbyFacts: [
      '2–6 players',
      '3 or 5 dice each',
      '20s a turn · 5s reveal',
      'Ones are wild',
    ],
    rules: `2–6 players · 3 or 5 dice each

Everybody rolls their dice in secret, then takes turns bidding on the whole table: at least so many dice showing one face. Ones are wild: they count as any face, so nobody bids on them. About a third of the dice show any face, ones included.

On your turn, raise the bid or call Liar. A raise is more dice of any face, or as many dice of a higher face. You have 20 seconds; run out and Liar is called for you, or one 2 is bid if nobody has bid yet.

Call Liar and every cup opens for 5 seconds. If the table holds at least as many as the bid said, the caller loses a die; if not, the bidder does. Whoever lost a die opens the next round. Lose your last die and you are out; the last player with dice wins.

On your own, play 1 to 5 bots with no clock, and go on to the next round when you are ready. Your wins are kept on this device.`,
    createDescription:
      'Take turns bidding on everybody’s dice. 3 dice each is a quick game; 5 is the classic.',
    solo: {
      summary: 'Roll in secret. Bid on the whole table. Call the bluff.',
      facts: [
        '1 to 5 bots, 3 or 5 dice each',
        'No clock: your turn waits for you',
        'Ones are wild, so nobody bids on them',
        'Your wins are kept on this device',
      ],
    },
  },
  {
    type: 'daily-word',
    name: 'Daily Word',
    tone: 'blue',
    tagline: 'Five letters, six guesses. A new word every day.',
    facts: 'Solo or 2–8 players',
    maxPlayers: 8,
    lobbySummary:
      'Everyone gets the same hidden five-letter word at once, with six guesses each. Fewer guesses score more.',
    lobbyFacts: [
      '2–8 players',
      '3 or 5 words',
      '2 minutes for each word',
      'Others see your marks, never your letters',
    ],
    rules: `2–8 players · 3 or 5 words

Find a hidden five-letter word in six guesses. Every guess must be a real word. After each one, every letter is marked: a green square is in the right place, a coral circle is in the word but somewhere else, and a flat grey tile is not in the word.

A letter is marked only as many times as it is in the word, and a letter in its right place counts first. A guess that is not a word, or one you already made, is turned back and costs nothing.

Everyone guesses the same word at the same time, with 2 minutes for each. Finding it pays 100 points for every guess you had left over, plus up to 50 for the time left. Others see your marks as you go, never your letters, and once you find it your chat waits until the word is revealed.

On your own, there is one word a day, the same for everybody, and a new one at your midnight. Your stats and streak are kept on this device. After it, play practice words as long as you like, and Challenge a friend sends them the same word.`,
    createDescription:
      'Every word is two minutes. Three words is a quick game.',
    solo: {
      summary:
        'One word a day, the same for everybody. Six guesses to find it.',
      facts: [
        'Every guess must be a real five-letter word',
        'Green square: right place. Coral circle: somewhere else. Grey: not in it',
        'A new word at your midnight; your streak is kept on this device',
        'Practice words after it, as many as you like',
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

/** "3 points", "1 pair": a score in its game's own unit. */
export function scoreOf(gameType: GameType, score: number): string {
  const unit = gameInfo(gameType).scoreUnit ?? 'point';
  return typeof unit === 'string'
    ? plural(score, unit)
    : plural(score, unit[0], unit[1]);
}
