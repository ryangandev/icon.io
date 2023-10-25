import { useEffect } from 'react';

const useCountdownTimer = (
    isActivePhase: boolean,
    timerValue: number,
    setTimerValue: (val: number) => void,
    phaseStartTimeRef: React.MutableRefObject<number | null>,
    timerMaxValue: number,
) => {
    useEffect(() => {
        let intervalId: NodeJS.Timeout | number;

        if (isActivePhase && timerValue === timerMaxValue) {
            phaseStartTimeRef.current = Date.now();
        }

        if (isActivePhase && timerValue > 0) {
            intervalId = setInterval(() => {
                const elapsed = Date.now() - (phaseStartTimeRef.current || 0); // Calculate the time passed since the start of the phase
                const remainingTime =
                    timerMaxValue - Math.floor(elapsed / 1000); // Calculate the remaining time
                setTimerValue(Math.max(0, remainingTime)); // Ensure it doesn't go below 0
            }, 1000);
        }

        return () => {
            clearInterval(intervalId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActivePhase]); // Refs don't need to be included because they don't cause re-render when they change, and their current value is always accessible; setTimerValue doesn't need to be included because it's a function and it doesn't change; timerMaxValue doesn't need to be included because it's a constant; timerValue should be removed so the hook doesn't rerun every second
};

export default useCountdownTimer;
