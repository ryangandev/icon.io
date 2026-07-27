import '../styles/components/game-info-bar.css';
import { Button } from 'antd';
import {
  FieldTimeOutlined,
  LogoutOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { formatTimeInMinutesAndSeconds } from '../libs/utils';

interface GameInfoBarProps {
  /** Seconds left in whichever phase the server currently has running. */
  secondsRemaining: number;
  currentRound: number;
  handleOnLeave: () => void;
  /**
   * Whatever the game wants to say in the middle — a word hint, a round
   * summary. The clock, the round counter and the leave button are the same
   * for everyone; the sentence between them never is.
   */
  children?: React.ReactNode;
}

const GameInfoBar = ({
  secondsRemaining,
  currentRound,
  handleOnLeave,
  children,
}: GameInfoBarProps) => {
  return (
    <div className="game-info-container">
      <div className="game-info-container-left">
        <FieldTimeOutlined style={{ fontSize: 32 }} />
        <span
          style={{
            width: 60,
            fontWeight: 500,
            fontSize: 24,
          }}
        >
          {formatTimeInMinutesAndSeconds(secondsRemaining)}
        </span>
      </div>

      <div className="game-info-container-center">{children}</div>

      <div className="game-info-container-right">
        <span className="game-info-status">Round: {currentRound}</span>
        <Button
          className="game-info-btn"
          onClick={() => {}}
          icon={<SettingOutlined style={{ fontSize: 32 }} />}
        />
        <Button
          className="game-info-btn"
          onClick={handleOnLeave}
          icon={<LogoutOutlined style={{ fontSize: 32 }} />}
        />
      </div>
    </div>
  );
};

export default GameInfoBar;
