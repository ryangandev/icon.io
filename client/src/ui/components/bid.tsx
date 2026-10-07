import { useMessages } from '../../i18n';
import { cx } from '../cx';
import { Die, type DieFace } from './die';
import styles from './bid.module.css';

export interface BidProps {
  /** Who made the bid. */
  name: string;
  /** At least this many dice on the table… */
  count: number;
  /** …show this face, ones included. */
  face: DieFace;
  /** The bid in front of the player whose turn it is; the round's earlier bids are quieter. */
  latest?: boolean;
  className?: string;
}

/** Zumpo/Bid: one bid of a round, "Leo 4 × ⚄". */
export function Bid({
  name,
  count,
  face,
  latest = false,
  className,
}: BidProps) {
  const m = useMessages();
  return (
    <span
      className={cx(styles.bid, latest && styles.latest, className)}
      aria-label={m.ui.dice.bid(name, count, face)}
    >
      <span className={styles.name} aria-hidden="true">
        {name}
      </span>
      <span className={styles.count} aria-hidden="true">
        {count}
      </span>
      <span className={styles.times} aria-hidden="true">
        ×
      </span>
      <Die face={face} size="compact" label={null} />
    </span>
  );
}
