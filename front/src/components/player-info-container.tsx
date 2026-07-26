import '../styles/components/player-info-container.css';
import '../assets/animations/oscillate.css';
import type { PlayerInfo } from '../models/types';

interface PlayerInfoContainerProps {
  playerInfo: PlayerInfo;
  isClient: boolean;
  isCurrentPlayerRoomOwner: boolean;
  isCurrentPlayerDrawer: boolean;
  ranking: number;
  isDrawingPhase: boolean;
}

const PlayerInfoContainer = ({
  playerInfo,
  isClient,
  isCurrentPlayerRoomOwner,
  isCurrentPlayerDrawer,
  ranking,
  isDrawingPhase,
}: PlayerInfoContainerProps) => {
  const { username, points, isConnected } = playerInfo;

  return (
    <div
      className={
        'draw-and-guess-room-player-info-container' +
        (isConnected ? '' : ' is-away')
      }
    >
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
      <div className="draw-and-guess-room-player-info-container-right">
        {/* Away rather than gone: the seat and the score are being held. */}
        {!isConnected && <span title="Reconnecting…">📴</span>}
        {isCurrentPlayerDrawer && (
          <span className={isDrawingPhase ? 'oscillate-emoji' : ''}>🖌️</span>
        )}
      </div>
      {isCurrentPlayerRoomOwner && (
        <span className="draw-and-guess-room-player-info-owner-icon">👑</span>
      )}
    </div>
  );
};

export default PlayerInfoContainer;
