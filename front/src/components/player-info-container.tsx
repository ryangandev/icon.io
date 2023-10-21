import { useEffect } from 'react';
import '../styles/components/player-info-container.css';
import { PlayerInfo } from '../models/types';

interface PlayerInfoContainerProps {
    playerInfo: PlayerInfo;
    isClient: boolean;
    isRoomOwner: boolean;
    isCurrentDrawer: boolean;
}

const PlayerInfoContainer = ({
    playerInfo,
    isClient,
    isRoomOwner,
    isCurrentDrawer,
}: PlayerInfoContainerProps) => {
    const { username, points, receivedPointsThisTurn } = playerInfo;

    useEffect(() => {}, []);

    return (
        <div className="draw-and-guess-room-player-info-container">
            <div className="draw-and-guess-room-player-info-container-left">
                <span className="draw-and-guess-room-player-info-ranking">
                    #8
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
        </div>
    );
};

export default PlayerInfoContainer;
