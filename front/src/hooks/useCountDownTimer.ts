import { useEffect, useState } from 'react';

const secondsUntil = (deadline: number): number =>
  deadline === 0 ? 0 : Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

/**
 * Counts down to a deadline issued by the server.
 *
 * The server sends how many milliseconds are left in the phase rather than the
 * wall-clock time it ends, and the room anchors that against its own clock — so
 * a client whose clock disagrees with the server's still counts down correctly,
 * and every phase change re-syncs instead of accumulating drift.
 *
 * Ticking faster than once a second costs nothing and means a tab that was
 * throttled in the background shows the right number the moment it is visible
 * again, rather than resuming from wherever it was frozen.
 */
const useCountdownTimer = (deadline: number): number => {
  const [secondsRemaining, setSecondsRemaining] = useState(() =>
    secondsUntil(deadline),
  );

  useEffect(() => {
    setSecondsRemaining(secondsUntil(deadline));

    if (deadline === 0) return;

    const intervalId = setInterval(() => {
      setSecondsRemaining(secondsUntil(deadline));
    }, 250);

    return () => clearInterval(intervalId);
  }, [deadline]);

  return secondsRemaining;
};

export default useCountdownTimer;
