import type { ReactNode } from 'react';
import { cx } from '../cx';
import { Icon } from './icon';
import styles from './mine-cell.module.css';

/** What one client can see of a cell. */
export type MineCellState =
  | { kind: 'hidden' }
  /** Your locked pick this round; nobody else sees it. */
  | { kind: 'picked' }
  | { kind: 'open'; adjacent: number }
  /** Somebody hit a mine here; it stays on the board. */
  | { kind: 'mine' };

export interface MineCellProps {
  state: MineCellState;
  /** Compact (26 px) is for the 30 × 16 board; Regular is 44 px, 36 px on phones. */
  size?: 'regular' | 'compact';
  /** Makes a hidden cell a button. Picks are simultaneous and irreversible. */
  onPick?: () => void;
  /** The cell's position, for its accessible name. */
  row: number;
  column: number;
  /** A Pick marker laid over the cell during the reveal. */
  marker?: ReactNode;
}

function describe(state: MineCellState): string {
  switch (state.kind) {
    case 'hidden':
      return 'hidden';
    case 'picked':
      return 'your pick';
    case 'mine':
      return 'mine';
    case 'open':
      return state.adjacent === 0 ? 'empty' : `${state.adjacent} adjacent`;
  }
}

/** Zumpo/Mine cell. There are no flags and no separate lock button. */
export function MineCell({
  state,
  size = 'regular',
  onPick,
  row,
  column,
  marker,
}: MineCellProps) {
  const pickable = state.kind === 'hidden' && onPick != null;
  const iconSize =
    size === 'compact' ? { picked: 12, mine: 16 } : { picked: 18, mine: 22 };
  const className = cx(
    styles.cell,
    size === 'compact' && styles.compact,
    state.kind === 'hidden' && styles.hidden,
    state.kind === 'picked' && styles.picked,
    state.kind === 'mine' && styles.mine,
    state.kind === 'open' && state.adjacent > 0 && styles[`n${state.adjacent}`],
    pickable && styles.pickable,
  );
  const label = `Row ${row + 1}, column ${column + 1}: ${describe(state)}`;

  // A grid cell of the board's role="grid"; a pickable one holds a button
  // that covers it, so the whole cell is the target.
  return (
    <span
      className={className}
      role="gridcell"
      aria-label={pickable ? undefined : label}
    >
      {state.kind === 'picked' && <Icon glyph="lock" size={iconSize.picked} />}
      {state.kind === 'mine' && <Icon glyph="mine" size={iconSize.mine} />}
      {state.kind === 'open' && state.adjacent > 0 && (
        <span aria-hidden="true">{state.adjacent}</span>
      )}
      {pickable && (
        <button
          type="button"
          className={styles.hit}
          aria-label={label}
          onClick={onPick}
        />
      )}
      {marker}
    </span>
  );
}
