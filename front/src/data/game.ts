import draw from '../assets/draw-and-guess-bg.png';
import minesweeper from '../assets/minesweeper-bg.png';

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
        navigateTo: '/Gamehub/Minesweeper/Lobby',
        thumbnailImg: minesweeper,
        thumbnailBgColor: '#A7A6BA',
        isAvailable: false,
    },
];

export { GameData };
