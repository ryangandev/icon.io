import { useEffect, useState } from 'react';

/**
 * Whole seconds a server clock has run, counting up: `sinceMs` as the
 * snapshot that arrived at `receivedAt` gave it, plus the time since. Like
 * `useSecondsLeft`, it counts from the snapshot, so a client clock that
 * disagrees with the server's still counts right.
 *
 * Paused, it holds the last value: while reconnecting the client cannot know
 * what the server's clock did.
 */
export function useSecondsSince(
  sinceMs: number,
  receivedAt: number,
  paused = false,
): number {
  const [seconds, setSeconds] = useState(() =>
    secondsSince(sinceMs, receivedAt),
  );

  useEffect(() => {
    if (paused) return;
    const tick = () => setSeconds(secondsSince(sinceMs, receivedAt));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [sinceMs, receivedAt, paused]);

  return seconds;
}

function secondsSince(sinceMs: number, receivedAt: number): number {
  const elapsed = performance.now() - receivedAt;
  return Math.max(0, Math.floor((sinceMs + elapsed) / 1000));
}
