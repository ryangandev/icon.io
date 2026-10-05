import type { CSSProperties } from 'react';
import { cx } from '../../ui/cx';
import styles from './distribution.module.css';

/**
 * DW04, DW05: how many daily words were found in 1 to 6 guesses, one bar
 * each, today's in green.
 */
export function Distribution({
  counts,
  today,
}: {
  counts: readonly number[];
  /** Today's guesses when it was found; no bar is picked out otherwise. */
  today: number | null;
}) {
  const most = Math.max(1, ...counts);
  return (
    <ol className={styles.list}>
      {counts.map((count, index) => (
        <li key={index} className={styles.row}>
          <span className={styles.guesses}>{index + 1}</span>
          <span
            className={cx(styles.bar, today === index + 1 && styles.today)}
            style={{ '--share': count / most } as CSSProperties}
            aria-label={`${count} found in ${index + 1}`}
          >
            <span aria-hidden="true">{count}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
