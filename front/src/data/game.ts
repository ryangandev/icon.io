import draw from '../assets/draw-and-guess-bg.png';
import minesweeper from '../assets/minesweeper-bg.png';

/**
 * The Gamehub's tiles. A game that is not available has no route yet — the
 * Gamehub renders its tile without a link rather than pointing one at a path
 * that lands on the 404 page.
 */
const GameData = [
  {
    title: 'Draw & Guess',
    navigateTo: '/Gamehub/DrawAndGuess/Lobby',
    thumbnailImg: draw,
    thumbnailBgColor: '#FFDFBF',
    isAvailable: true,
  },
  {
    title: 'Minesweeper',
    navigateTo: '',
    thumbnailImg: minesweeper,
    thumbnailBgColor: '#A7A6BA',
    isAvailable: false,
  },
];

export { GameData };
