import { cx } from '../cx';
import styles from './stat-list.module.css';

export interface Stat {
  label: string;
  value: string;
  /** Muted for a value not there yet ("Not yet"), green for a new best. */
  tone?: 'muted' | 'green';
}

/** Label and value rows, as on a game's "This game" and "Best on this device". */
export function StatList({
  stats,
  className,
}: {
  stats: readonly Stat[];
  className?: string;
}) {
  return (
    <dl className={cx(styles.list, className)}>
      {stats.map((stat) => (
        <div key={stat.label} className={styles.row}>
          <dt className={styles.label}>{stat.label}</dt>
          <dd className={cx(styles.value, stat.tone && styles[stat.tone])}>
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
