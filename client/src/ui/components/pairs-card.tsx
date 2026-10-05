import { cx } from '../cx';
import { PairsSymbol, symbolName } from './pairs-symbol';
import styles from './pairs-card.module.css';

export type PairsCardState =
  | { kind: 'down' }
  /** Turned over this turn. */
  | { kind: 'up'; symbol: number }
  /** One of a pair somebody found; it stays where it lies. */
  | { kind: 'matched'; symbol: number };

export interface PairsCardProps {
  state: PairsCardState;
  /** Regular is 80 px; Compact, 52 px, fits a 6 × 6 board on a phone. */
  size?: 'regular' | 'compact';
  /** Makes a face-down card a button that turns it over. */
  onPick?: () => void;
  /** The card's place, for its accessible name. */
  row: number;
  column: number;
}

function describe(state: PairsCardState): string {
  switch (state.kind) {
    case 'down':
      return 'face down';
    case 'up':
      return symbolName(state.symbol);
    case 'matched':
      return `${symbolName(state.symbol)}, matched`;
  }
}

/** Zumpo/Pairs card: one card of a Pairs board, in its place. */
export function PairsCard({
  state,
  size = 'regular',
  onPick,
  row,
  column,
}: PairsCardProps) {
  const compact = size === 'compact';
  const label = `Row ${row + 1}, column ${column + 1}: ${describe(state)}`;
  const actionable = state.kind === 'down' && onPick != null;
  return (
    <span
      className={cx(
        styles.card,
        compact && styles.compact,
        styles[state.kind],
        actionable && styles.pickable,
      )}
      role="gridcell"
      aria-label={actionable ? undefined : label}
    >
      {state.kind !== 'down' && (
        <PairsSymbol
          symbol={state.symbol}
          size={compact ? 30 : 44}
          className={styles.symbol}
        />
      )}
      {actionable && (
        <button
          type="button"
          className={styles.hit}
          aria-label={label}
          onClick={onPick}
        />
      )}
    </span>
  );
}
