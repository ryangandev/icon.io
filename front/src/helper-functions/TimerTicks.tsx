import { useEffect, useState } from "react";
import {socket} from "../socket";

interface TimerProps {
    countdownInSec: number;
    isTimerRunning: boolean;
    roomId : string | undefined;
}
const TimerTicks: React.FC<TimerProps> = (props: TimerProps) => {
    const [countdown, setCountdown] = useState(props.countdownInSec);
    const [stop, setStop] = useState<boolean>(false);
    const roomId = props.roomId;
    
    useEffect(() => {
        if (!stop && props.isTimerRunning) {
            const interval = setInterval(() => {
                setCountdown(countdown - 1);

                if (countdown <= 0) {
                    setStop(true);
                    setCountdown(0);
                    socket.emit('stopGame', false, roomId);
                }
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [props.isTimerRunning, props.countdownInSec, countdown]);

    return (
        <div>
            {countdown}
        </div>
    )
}

export default TimerTicks;