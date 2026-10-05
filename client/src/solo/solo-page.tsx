import type { GameType } from '../../../shared/wire-types';
import { Make24Solo } from '../make-24/solo/solo-page';
import { MinesweeperSolo } from '../minesweeper/solo/solo-page';
import { PairsSolo } from '../pairs/solo/solo-page';
import { LiarsDiceSolo } from '../liars-dice/solo/solo-page';
import NotFoundPage from '../pages/not-found';

/** /games/:game/solo: a game on your own, for the games that have one. */
export default function SoloPage({ gameType }: { gameType: GameType }) {
  switch (gameType) {
    case 'minesweeper':
      return <MinesweeperSolo />;
    case 'make-24':
      return <Make24Solo />;
    case 'pairs':
      return <PairsSolo />;
    case 'liars-dice':
      return <LiarsDiceSolo />;
    default:
      return <NotFoundPage />;
  }
}
