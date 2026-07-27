import { statusColors } from '../libs/utils';
import type { RoomStatus } from '../models/types';
import '../styles/components/game-info-board.css';

interface GameInfoItem {
  label: string;
  value: string | number;
}

interface GameInfoBoardProps {
  /**
   * The rows to show, in order. This used to be six named props — one of them
   * `wordCategory` — which made a panel every room needs into a thing only
   * Draw & Guess could use. Each game names its own rows now; `Status` is the
   * one label with special rendering, because its colour means something.
   */
  items: GameInfoItem[];
}

const GameInfoBoard = ({ items }: GameInfoBoardProps) => {
  return (
    <div className="game-info-board">
      <div className="game-info-board-header">
        📜 <span>Room Info</span>
      </div>
      {items.map((item, index) => (
        <div className="game-info-board-row" key={index}>
          {item.label}:{' '}
          <span
            className="game-info-board-text"
            style={
              item.label === 'Status'
                ? { color: statusColors[item.value as RoomStatus] }
                : {}
            }
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default GameInfoBoard;
export type { GameInfoItem };
