import '../styles/components/game-info-bar.css';
import { Button } from 'antd';
import {
    FieldTimeOutlined,
    LogoutOutlined,
    SettingOutlined,
} from '@ant-design/icons';
import { useEffect } from 'react';
import { formatTimeInMinutesAndSeconds } from '../libs/utils';
import { timer } from '../data/timer';

interface GameInfoBarProps {
    isGameStarted: boolean;
    isWordSelectingPhase: boolean;
    isDrawingPhase: boolean;
    isDrawer: boolean;
    currentDrawer: string;
    currentWord: string;
    currentWordHint: string;
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
    currentDrawer,
    currentWord,
    currentWordHint,
    handleOnLeave,
    startTimeRef,
    drawingPhaseTimer,
    setDrawingPhaseTimer,
}: GameInfoBarProps) => {
    useEffect(() => {
        let intervalId: NodeJS.Timeout | number;

        // Initialize start time when entering word selecting phase
        if (isDrawingPhase && drawingPhaseTimer === timer.drawingPhaseTimer) {
            startTimeRef.current = Date.now();
        }

        if (isDrawingPhase && drawingPhaseTimer > 0) {
            intervalId = setInterval(() => {
                const elapsed = Date.now() - (startTimeRef.current || 0); // Calculate the time passed since the start of drawing phase
                const remainingTime =
                    timer.drawingPhaseTimer - Math.floor(elapsed / 1000); // Calculate the remaining time
                setDrawingPhaseTimer(Math.max(0, remainingTime)); // Ensure it doesn't go below 0
            }, 1000);
        }

        return () => {
            clearInterval(intervalId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDrawingPhase, drawingPhaseTimer]); // Refs don't need to be included because they don't cause re-render when they change, and their current value is always accessible

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
                {!isGameStarted && <></>}
                {isWordSelectingPhase && (
                    <span style={{ fontWeight: 400, fontSize: 18 }}>
                        <span style={{ fontWeight: 700 }}>{currentDrawer}</span>{' '}
                        is selecting a word
                    </span>
                )}
                {isDrawingPhase && isDrawer && (
                    <>
                        <span style={{ fontWeight: 400, fontSize: 12 }}>
                            Draw
                        </span>
                        <span style={{ fontWeight: 700, fontSize: 24 }}>
                            {currentWord}
                        </span>
                    </>
                )}
                {isDrawingPhase && !isDrawer && (
                    <>
                        <span style={{ fontWeight: 400, fontSize: 12 }}>
                            Guess
                        </span>
                        <span style={{ fontWeight: 700, fontSize: 24 }}>
                            {currentWordHint}
                        </span>
                    </>
                )}
            </div>

            <div className="game-info-container-right">
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
