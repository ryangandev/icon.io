import '../styles/GameInfoBar.css';
import { Button } from 'antd';
import { ClockCircleOutlined, LogoutOutlined } from '@ant-design/icons';
import { useState } from 'react';
import TimerTicks from '../helper-functions/TimerTicks';
import { socket } from '../socket';

interface GameInfoBarProps {
    roomId: string | undefined;
    isDrawer: boolean;
    wordForDrawer: string;
    handleOnLeave: () => void;
}

const GameInfoBar: React.FC<GameInfoBarProps> = (props: GameInfoBarProps) => {
    const roundTime = 10;
    const [isTimeTicking, setIsTimeTicking] = useState<boolean>(false);
    const [timer, setTimer] = useState(roundTime);
    const isDrawer = props.isDrawer;
    const word = props.wordForDrawer;
    const roomId = props.roomId;

    socket.on('startTimer', (data) => {
        setIsTimeTicking(true);
    });

    return (
        <div className="game-info-container">
            <div className="left-info">
                <div className="room-info">Room: {props.roomId}</div>
            </div>
            {isDrawer && (
                <div className="middle-info">
                    <div style={{ fontSize: 12 }}>Draw</div>
                    <div style={{ fontSize: 30, fontWeight: 600 }}>{word}</div>
                </div>
            )}
            <div className="right-info">
                <ClockCircleOutlined className="clock-icon" />
                <div className="timer">
                    <TimerTicks
                        countdownInSec={timer}
                        isTimerRunning={isTimeTicking}
                        roomId={roomId}
                    />
                </div>
                <div className="round-info">Round 1/5</div>
                <Button className="logout-btn" onClick={props.handleOnLeave}>
                    <LogoutOutlined className="logout-icon" />
                </Button>
            </div>
        </div>
    );
};

export default GameInfoBar;
