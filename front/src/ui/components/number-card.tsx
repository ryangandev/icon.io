import { cx } from '../cx';
import styles from './number-card.module.css';

export type NumberCardState =
  | 'default'
  /** Picked as the first card of a step. */
  | 'selected'
  /** Made from two cards by a step. */
  | 'made'
  /** The last card, and it is 24. */
  | 'solved'
  /** The last card, and it is not. */
  | 'not-24';

export interface NumberCardProps {
  /** "7", "8/3", "−2". */
  value: string;
  /** The small print under the value: the step that made it, or "Not 24". */
  formula?: string;
  state?: NumberCardState;
  /** Compact is for a phone and a game card's art; Regular is 112 × 144. */
  size?: 'regular' | 'compact';
  /** Makes the card a button. */
  onPick?: () => void;
  /** A card that cannot be picked now, such as a 0 after ÷. */
  disabled?: boolean;
  /** The card's accessible name, when it is a button. */
  label?: string;
}

/** Zumpo/Number card: one card of a Make 24 hand. */
export function NumberCard({
  value,
  formula,
  state = 'default',
  size = 'regular',
  onPick,
  disabled,
  label,
}: NumberCardProps) {
  const className = cx(
    styles.card,
    size === 'compact' && styles.compact,
    // A fraction or a negative will not fit the card at full size.
    [...value].length > 2 && styles.long,
    state !== 'default' && styles[state],
  );
  const content = (
    <>
      <span className={styles.value}>{value}</span>
      {formula && <span className={styles.formula}>{formula}</span>}
    </>
  );
  if (!onPick) {
    return (
      <span className={className} aria-label={label}>
        {content}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={cx(className, styles.button)}
      aria-label={label}
      aria-pressed={state === 'selected'}
      disabled={disabled}
      onClick={onPick}
    >
      {content}
    </button>
  );
}
