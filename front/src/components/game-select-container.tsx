import { FC } from 'react';
import toast from 'react-hot-toast';
import '../styles/components/GameSelectContainer.css';

interface GameSelectProps {
    gameTitle: string;
    isAvailable?: boolean;
    color: string;
    img: string;
}

const GameSelect: FC<GameSelectProps> = ({
    color,
    img,
    isAvailable = true,
    gameTitle,
}: GameSelectProps) => {
    // When a game is not available, we want to prevent the user from being able clicking on it
    const handleClick = (event: React.MouseEvent) => {
        if (!isAvailable) {
            event.preventDefault();
            event.stopPropagation();
            toast.error(`Sorry, ${gameTitle} is currently not available!`);
        }
    };

    return (
        <div
            className="game-select-container"
            style={{
                cursor: isAvailable ? 'pointer' : 'not-allowed',
            }}
            onClick={handleClick}
        >
            <img
                src={img}
                alt="game-icon"
                className="game-select-img"
                style={{
                    backgroundColor: color,
                    pointerEvents: isAvailable ? 'auto' : 'none',
                    opacity: isAvailable ? 1 : 0.25,
                }}
            />
            <span className="game-select-title">{gameTitle}</span>
        </div>
    );
};

export default GameSelect;
