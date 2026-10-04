import { cx } from '../cx';
import styles from './wordmark.module.css';

/** Zumpo/Wordmark: the lowercase name with its coral dot. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx(styles.wordmark, className)}>
      zumpo
      <span className={styles.dot} aria-hidden="true">
        .
      </span>
    </span>
  );
}
