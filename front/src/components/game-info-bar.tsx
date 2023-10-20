import '../styles/components/game-info-bar.css';
import { Button } from 'antd';
import {
    FieldTimeOutlined,
    LogoutOutlined,
    SettingOutlined,
} from '@ant-design/icons';
import { useEffect } from 'react';
import { formatTimeInMinutesAndSeconds } from '../libs/utils';

interface GameInfoBarProps {
    isGameStarted: boolean;
    isWordSelectingPhase: boolean;
    isDrawingPhase: boolean;
    isDrawer: boolean;
    currentWord: string;
    currentWordLength: number;
    handleOnLeave: () => void;
    drawingPhaseTimer: number;
    setDrawingPhaseTimer: React.Dispatch<React.SetStateAction<number>>;
}

const GameInfoBar = ({
    isGameStarted,
    isWordSelectingPhase,
    isDrawingPhase,
    isDrawer,
    currentWord,
    currentWordLength,
    handleOnLeave,
    drawingPhaseTimer,
    setDrawingPhaseTimer,
}: GameInfoBarProps) => {
    useEffect(() => {
        let intervalId: NodeJS.Timeout | number;

        // For drawingPhaseTimer countdown
        if (isDrawingPhase && drawingPhaseTimer > 0) {
            intervalId = setInterval(() => {
                setDrawingPhaseTimer((prevTimer) => prevTimer - 1);
            }, 1000);
        }

        // Cleanup: clear the interval when component unmounts or conditions change
        return () => {
            clearInterval(intervalId);
        };
    }, [isDrawingPhase, drawingPhaseTimer, setDrawingPhaseTimer]);

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
                    <span style={{ fontWeight: 400, fontSize: 12 }}>
                        Drawer is selecting a word
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
                            {currentWordLength} letters
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
