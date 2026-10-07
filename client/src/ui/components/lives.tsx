import { useMessages, type Messages } from '../../i18n';
import { cx } from '../cx';
import styles from './lives.module.css';

export interface LivesProps {
  /** Lives left, from 0 to `of`. */
  lives: number;
  /** The most a team can hold. */
  of?: number;
  /** The count in words beside the hearts. */
  showLabel?: boolean;
  className?: string;
}

/** The Figma heart, 20 × 18. */
const HEART =
  'M10 18C10 18 0 11.6 0 5.4 0 2.4 2.4 0 5.4 0 7.4 0 9.1 1.1 10 2.8 10.9 1.1 12.6 0 14.6 0 17.6 0 20 2.4 20 5.4 20 11.6 10 18 10 18Z';

export const livesLabel = (lives: number, m: Messages) => m.ui.lives(lives);

/** Zumpo/Lives: a team's lives in Hush, as hearts full or lost. */
export function Lives({
  lives,
  of = 3,
  showLabel = true,
  className,
}: LivesProps) {
  const m = useMessages();
  return (
    <span
      className={cx(styles.lives, className)}
      role="img"
      aria-label={livesLabel(lives, m)}
    >
      <span className={styles.hearts}>
        {Array.from({ length: of }, (_, index) => (
          <svg
            key={index}
            className={cx(styles.heart, index < lives && styles.full)}
            width="20"
            height="18"
            viewBox="0 0 20 18"
          >
            <path d={HEART} />
          </svg>
        ))}
      </span>
      {showLabel && (
        <span className={styles.label}>{livesLabel(lives, m)}</span>
      )}
    </span>
  );
}
