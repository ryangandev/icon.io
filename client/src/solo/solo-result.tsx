import type { ReactNode } from 'react';
import { StatList, type Stat } from '../ui';
import styles from './solo-result.module.css';

/**
 * A finished game on your own, over the board it was played on (MS04, T05,
 * PR04): how it went, its numbers and what next.
 */
export function SoloResult({
  title,
  body,
  stats,
  actions,
}: {
  /** "Cleared in 3:05." */
  title: string;
  /** How it compares with the best on this device. */
  body: string;
  stats: readonly Stat[];
  /** Buttons, primary first. */
  actions: ReactNode;
}) {
  return (
    <section className={styles.result} aria-labelledby="solo-result-title">
      <div className={styles.heading}>
        <h2 id="solo-result-title" className={styles.title}>
          {title}
        </h2>
        <p className={styles.body}>{body}</p>
      </div>
      <StatList stats={stats} />
      <div className={styles.actions}>{actions}</div>
    </section>
  );
}
