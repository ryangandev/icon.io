import '../styles/components/game-info-bar.css';
import { Button } from 'antd';
import {
    FieldTimeOutlined,
    LogoutOutlined,
    SettingOutlined,
} from '@ant-design/icons';
import { formatTimeInMinutesAndSeconds } from '../libs/utils';
import { timer } from '../data/timer';
import useCountdownTimer from '../hooks/useCountDownTimer';

interface GameInfoBarProps {
    isGameStarted: boolean;
    isWordSelectingPhase: boolean;
    isDrawingPhase: boolean;
    isDrawer: boolean;
    currentRound: number;
    currentDrawer: string;
    currentWord: string;
    currentWordHint: string;
    receivedPointsThisTurn: boolean;
    handleOnLeave: () => void;
    startTimeRef: React.MutableRefObject<number | null>;
    drawingPhaseTimer: number;
    setDrawingPhaseTimer: React.Dispatch<React.SetStateAction<number>>;
}

const GameInfoBar = ({
    isGameStarted,
    isWordSelectingPhase,
    isDrawingPhase,
    isDrawer,
    currentRound,
    currentDrawer,
    currentWord,
    currentWordHint,
    receivedPointsThisTurn,
    handleOnLeave,
    startTimeRef,
    drawingPhaseTimer,
    setDrawingPhaseTimer,
}: GameInfoBarProps) => {
    useCountdownTimer(
        isDrawingPhase,
        drawingPhaseTimer,
        setDrawingPhaseTimer,
        startTimeRef,
        timer.drawingPhaseTimer,
    );

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
                    {formatTimeInMinutesAndSeconds(drawingPhaseTimer)}
                </span>
            </div>
            <div className="game-info-container-center">
                {!isGameStarted && (
                    <span className="game-info-status">
                        Waiting for players...
                    </span>
                )}
                {isWordSelectingPhase && (
                    <span className="game-info-status">
                        <span style={{ fontWeight: 800 }}>{currentDrawer}</span>{' '}
                        is selecting a word
                    </span>
                )}
                {isDrawingPhase && isDrawer && (
                    <>
                        <span className="game-info-action-indicator">Draw</span>
                        <span className="game-info-current-word">
                            {currentWord}
                        </span>
                    </>
                )}
                {isDrawingPhase && !isDrawer && (
                    <>
                        {receivedPointsThisTurn ? (
                            <span className="game-info-status">
                                ✅ You Guessed the Correct Word!
                            </span>
                        ) : (
                            <>
                                <span className="game-info-action-indicator">
                                    Guess
                                </span>
                                <span className="game-info-current-word game-info-hint ">
                                    {currentWordHint}
                                </span>
                            </>
                        )}
                    </>
                )}
            </div>

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
