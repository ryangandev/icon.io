import { statusColors } from '../libs/utils';
import { RoomStatus } from '../models/types';
import '../styles/components/game-info-board.css';

interface GameInfoBoardProps {
    name: string;
    owner: string;
    status: RoomStatus;
    players: string;
    rounds: number;
    wordCategory: string;
}

const GameInfoBoard = ({
    name,
    owner,
    status,
    players,
    rounds,
    wordCategory,
}: GameInfoBoardProps) => {
    const gameInfoItems = [
        { label: 'Name', value: name },
        { label: 'Owner', value: owner },
        { label: 'Status', value: status },
        { label: 'Players', value: players },
        { label: 'MaxRounds', value: rounds },
        { label: 'Category', value: wordCategory },
    ];

    return (
        <div className="game-info-board">
            <div className="game-info-board-header">
                📜 <span>Room Info</span>
            </div>
            {gameInfoItems.map((item, index) => (
                <div className="game-info-board-row" key={index}>
                    {item.label}:{' '}
                    <span
                        className="game-info-board-text"
                        style={
                            item.label === 'Status'
                                ? {
                                      color: statusColors[
                                          item.value as RoomStatus
                                      ],
                                  }
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
