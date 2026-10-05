import { cx } from '../cx';
import { Icon } from './icon';
import styles from './countdown.module.css';

/** The last seconds of a phase you act in turn the clock urgent. */
export const URGENT_SECONDS = 5;

export interface CountdownProps {
  /** Seconds left, as the server sent them; the client never runs its own clock. */
  seconds: number;
  /** What the clock is for: "to pick", "to draw". */
  label: string;
  /** Someone else is acting, or a reveal is on. */
  waiting?: boolean;
  className?: string;
}

export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(whole / 60);
  return `${String(minutes).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

/** Zumpo/Countdown: the server-driven phase clock. */
export function Countdown({
  seconds,
  label,
  waiting = false,
  className,
}: CountdownProps) {
  const tone = waiting
    ? 'waiting'
    : seconds <= URGENT_SECONDS
      ? 'urgent'
      : 'running';
  return (
    <span
      role="timer"
      className={cx(
        styles.countdown,
        tone !== 'running' && styles[tone],
        className,
      )}
    >
      <Icon glyph="clock" size={20} />
      <span className={styles.time}>
        {[...formatClock(seconds)].map((char, index) =>
          char === ':' ? (
            char
          ) : (
            <span key={index} className={styles.digit}>
              {char}
            </span>
          ),
        )}
      </span>
      <span className={styles.label}>{label}</span>
    </span>
  );
}
