import type { GameType } from '../../../shared/wire-types';
import { MinesweeperSolo } from '../minesweeper/solo/solo-page';
import NotFoundPage from '../pages/not-found';

/** /games/:game/solo: a game on your own, for the games that have one. */
export default function SoloPage({ gameType }: { gameType: GameType }) {
  switch (gameType) {
    case 'minesweeper':
      return <MinesweeperSolo />;
    default:
      return <NotFoundPage />;
  }
}
