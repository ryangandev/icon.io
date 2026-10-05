import { useRef, type PointerEvent, type ReactNode } from 'react';
import { cx } from '../cx';
import { Icon } from './icon';
import styles from './mine-cell.module.css';

/** What one client can see of a cell. */
export type MineCellState =
  | { kind: 'hidden' }
  /** Your locked pick this round; nobody else sees it. */
  | { kind: 'picked' }
  | { kind: 'open'; adjacent: number }
  /** Somebody hit a mine here; it stays on the board. On your own, a mine shown once the game is lost. */
  | { kind: 'mine' }
  /** On your own: a hidden cell you flagged. */
  | { kind: 'flag' }
  /** On your own, once lost: a flag with no mine under it. */
  | { kind: 'wrong-flag' }
  /** On your own: the mine that lost the game. */
  | { kind: 'hit' };

export interface MineCellProps {
  state: MineCellState;
  /** Compact (26 px) is for the 30 × 16 board; Regular is 44 px, 36 px on phones. */
  size?: 'regular' | 'compact';
  /**
   * Makes the cell a button: a pick in a room, a reveal or a chord on your
   * own. Whoever renders the board passes it only to cells that can act.
   */
  onPick?: () => void;
  /** Right-click or long-press: on your own, plants or lifts a flag. */
  onMark?: () => void;
  /** The cell's position, for its accessible name. */
  row: number;
  column: number;
  /** A Pick marker laid over the cell during the reveal. */
  marker?: ReactNode;
}

/** How long a touch is held before it flags instead of opening. */
const LONG_PRESS_MS = 450;

function describe(state: MineCellState): string {
  switch (state.kind) {
    case 'hidden':
      return 'hidden';
    case 'picked':
      return 'your pick';
    case 'mine':
      return 'mine';
    case 'flag':
      return 'flagged';
    case 'wrong-flag':
      return 'flagged, no mine';
    case 'hit':
      return 'the mine you hit';
    case 'open':
      return state.adjacent === 0 ? 'empty' : `${state.adjacent} adjacent`;
  }
}

/** Zumpo/Mine cell. Rooms have no flags and no separate lock button. */
export function MineCell({
  state,
  size = 'regular',
  onPick,
  onMark,
  row,
  column,
  marker,
}: MineCellProps) {
  const compact = size === 'compact';
  const iconSize = compact
    ? { picked: 12, mine: 16, flag: 12 }
    : { picked: 18, mine: 22, flag: 18 };
  const actionable = onPick != null || onMark != null;
  const className = cx(
    styles.cell,
    compact && styles.compact,
    (state.kind === 'hidden' || state.kind === 'flag') && styles.hidden,
    state.kind === 'picked' && styles.picked,
    state.kind === 'mine' && styles.mine,
    state.kind === 'hit' && styles.hitMine,
    state.kind === 'open' && state.adjacent > 0 && styles[`n${state.adjacent}`],
    actionable &&
      (state.kind === 'hidden' || state.kind === 'flag') &&
      styles.pickable,
  );
  const label = `Row ${row + 1}, column ${column + 1}: ${describe(state)}`;
  const press = useLongPress(onMark);

  // A grid cell of the board's role="grid"; an actionable one holds a button
  // that covers it, so the whole cell is the target.
  return (
    <span
      className={className}
      role="gridcell"
      aria-label={actionable ? undefined : label}
    >
      {state.kind === 'picked' && <Icon glyph="lock" size={iconSize.picked} />}
      {(state.kind === 'mine' || state.kind === 'hit') && (
        <Icon glyph="mine" size={iconSize.mine} />
      )}
      {state.kind === 'flag' && (
        <Icon glyph="flag" size={iconSize.flag} className={styles.flag} />
      )}
      {state.kind === 'wrong-flag' && (
        <span className={styles.crossed}>
          <Icon glyph="flag" size={iconSize.flag} className={styles.flag} />
          <svg
            className={styles.cross}
            width={iconSize.flag}
            height={iconSize.flag}
            viewBox={`0 0 ${iconSize.flag} ${iconSize.flag}`}
            aria-hidden="true"
          >
            <line
              x1={1}
              y1={1}
              x2={iconSize.flag - 1}
              y2={iconSize.flag - 1}
              strokeWidth={compact ? 1.5 : 2}
            />
          </svg>
        </span>
      )}
      {state.kind === 'open' && state.adjacent > 0 && (
        <span aria-hidden="true">{state.adjacent}</span>
      )}
      {actionable && (
        <button
          type="button"
          className={styles.hit}
          aria-label={label}
          onClick={() => {
            if (press.consumed()) return;
            onPick?.();
          }}
          onContextMenu={(event) => {
            if (!onMark) return;
            event.preventDefault();
            // A long touch fires contextmenu on some browsers; it already flagged.
            if (!press.consumed()) onMark();
          }}
          {...press.handlers}
        />
      )}
      {marker}
    </span>
  );
}

/**
 * A held touch calls `onLongPress` once and swallows the click that follows,
 * so a long-press flags rather than opens. Mouse and pen use right-click.
 */
function useLongPress(onLongPress?: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    /** True once after a long-press fired; resets itself. */
    consumed() {
      const was = fired.current;
      fired.current = false;
      return was;
    },
    handlers: onLongPress
      ? {
          onPointerDown(event: PointerEvent) {
            if (event.pointerType !== 'touch') return;
            fired.current = false;
            cancel();
            timer.current = setTimeout(() => {
              fired.current = true;
              onLongPress();
            }, LONG_PRESS_MS);
          },
          onPointerUp: cancel,
          onPointerLeave: cancel,
          onPointerCancel: cancel,
        }
      : {},
  };
}
