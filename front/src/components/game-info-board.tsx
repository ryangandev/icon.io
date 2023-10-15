import '../styles/components/game-info-board.css';
import { CiBullhorn } from 'react-icons/ci';

interface GameInfoBoardProps {
    name: string;
    owner: string;
    status: string;
    players: string;
    rounds: string;
}

const GameInfoBoard = ({
    name,
    owner,
    status,
    players,
    rounds,
}: GameInfoBoardProps) => {
    const gameInfoItems = [
        { label: 'Name', value: name },
        { label: 'Owner', value: owner },
        { label: 'Status', value: status },
        { label: 'Players', value: players },
        { label: 'Rounds', value: rounds },
    ];

    return (
        <div className="game-info-board">
            <div className="game-info-board-header">
                <CiBullhorn style={{ fontSize: 18 }} />
                <span>Room Info</span>
            </div>
            {gameInfoItems.map((item, index) => (
                <div key={index}>
                    {item.label}:{' '}
                    <span className="game-info-board-text">{item.value}</span>
                </div>
            ))}
        </div>
    );
};

export default GameInfoBoard;
