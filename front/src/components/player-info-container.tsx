import { useEffect } from 'react';
import '../styles/components/player-info-container.css';
import scoreIcon from '../assets/score-icon.png';
import { PlayerInfo } from '../models/types';

interface PlayerInfoContainerProps {
    playerInfo: PlayerInfo;
    isClient: boolean;
    isCurrentDrawer: boolean;
}

const PlayerInfoContainer = ({
    playerInfo,
    isClient,
    isCurrentDrawer,
}: PlayerInfoContainerProps) => {
    const { username, score } = playerInfo;

    useEffect(() => {}, []);

    return (
        <div className="player-info">
            <div className="player-info-name">
                {username} {isClient ? '(You)' : ''}
            </div>
            <div className="player-info-score">
                <img
                    src={scoreIcon}
                    style={{ height: 20, width: 20, marginRight: 5 }}
                    alt="score"
                />
                {score} points
            </div>
        </div>
    );
};

export default PlayerInfoContainer;
