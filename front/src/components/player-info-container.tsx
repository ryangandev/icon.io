import '../styles/components/player-info-container.css';
import { PlayerInfo } from '../models/types';

interface PlayerInfoContainerProps {
    playerInfo: PlayerInfo;
    isClient: boolean;
    isCurrentPlayerRoomOwner: boolean;
    isCurrentDrawer: boolean;
    ranking: number;
}

const PlayerInfoContainer = ({
    playerInfo,
    isClient,
    isCurrentPlayerRoomOwner,
    isCurrentDrawer,
    ranking,
}: PlayerInfoContainerProps) => {
    const { username, points } = playerInfo;

    return (
        <div className="draw-and-guess-room-player-info-container">
            <div className="draw-and-guess-room-player-info-container-left">
                <span className="draw-and-guess-room-player-info-ranking">
                    #{ranking}
                </span>
            </div>
            <div className="draw-and-guess-room-player-info-container-center">
                <span className="draw-and-guess-room-player-info-username">
                    {username} {isClient ? '(You)' : ''}
                </span>
                <span className="draw-and-guess-room-player-info-score">
                    {points} pts
                </span>
            </div>
            <div className="draw-and-guess-room-player-info-container-right"></div>
            {isCurrentPlayerRoomOwner && (
                <span className="draw-and-guess-room-player-info-owner-icon">
                    👑
                </span>
            )}
        </div>
    );
};

export default PlayerInfoContainer;
