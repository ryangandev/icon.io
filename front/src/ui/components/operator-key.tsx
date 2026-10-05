import { cx } from '../cx';
import styles from './operator-key.module.css';

export interface OperatorKeyProps {
  /** "+", "−", "×" or "÷". */
  symbol: string;
  /** Its accessible name: "plus", "minus", "times", "divided by". */
  label: string;
  selected?: boolean;
  onPick?: () => void;
  disabled?: boolean;
}

/** Zumpo/Operator key: one of Make 24's four signs. */
export function OperatorKey({
  symbol,
  label,
  selected = false,
  onPick,
  disabled,
}: OperatorKeyProps) {
  return (
    <button
      type="button"
      className={cx(styles.key, selected && styles.selected)}
      aria-label={label}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onPick}
    >
      <span aria-hidden="true">{symbol}</span>
    </button>
  );
}
