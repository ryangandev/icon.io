import type {
  MinesweeperPickResult,
  MinesweeperRoomState,
} from '../../../shared/wire-types';
import {
  MineCell,
  PickMarker,
  type MineCellState,
  type PickOutcome,
} from '../ui';
import { cx } from '../ui/cx';
import { initialsOf } from '../players/avatar';
import { PHONE, useMediaQuery } from '../shell/use-media-query';
import styles from './board.module.css';

const HIDDEN = -1;
const MINE = 9;

export interface BoardProps {
  state: MinesweeperRoomState;
  /** Set while this player may pick: picks are simultaneous and final. */
  onPick?: (index: number) => void;
  /** Lays each pick of the round over its cell, during the reveal. */
  showPicks: boolean;
}

/**
 * The shared minefield. A Large board uses compact cells; on a phone, a
 * board wider than Small keeps full-size cells and pans sideways.
 */
export function Board({ state, onPick, showPicks }: BoardProps) {
  const { width, height, board, myPick } = state;
  const phone = useMediaQuery(PHONE);
  // Compact cells fit a Large board on a desktop; a phone pans instead.
  const compact = width > 16 && !phone;
  const markers = showPicks ? markersByCell(state.lastRound) : new Map();

  const cellState = (index: number): MineCellState => {
    const value = board[index];
    if (value === MINE) return { kind: 'mine' };
    if (value === HIDDEN) {
      return index === myPick && state.phase === 'picking'
        ? { kind: 'picked' }
        : { kind: 'hidden' };
    }
    return { kind: 'open', adjacent: value };
  };

  return (
    <div
      className={cx(
        styles.viewport,
        compact && styles.compact,
        width > 9 && styles.pans,
      )}
    >
      <div
        className={styles.board}
        role="grid"
        aria-label={`Board, ${width} by ${height}`}
        aria-rowcount={height}
        aria-colcount={width}
      >
        {Array.from({ length: height }, (_, row) => (
          <div key={row} className={styles.row} role="row">
            {Array.from({ length: width }, (_cell, column) => {
              const index = row * width + column;
              const marker = markers.get(index);
              return (
                <MineCell
                  key={column}
                  row={row}
                  column={column}
                  size={compact ? 'compact' : 'regular'}
                  state={cellState(index)}
                  onPick={onPick ? () => onPick(index) : undefined}
                  marker={
                    marker && (
                      <PickMarker
                        outcome={marker.outcome}
                        initials={marker.initials}
                        size={compact ? 'compact' : 'regular'}
                      />
                    )
                  }
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** One marker per picked cell: whose it was, or "×2" when it was shared. */
function markersByCell(picks: readonly MinesweeperPickResult[]) {
  const byCell = new Map<number, MinesweeperPickResult[]>();
  for (const pick of picks) {
    byCell.set(pick.index, [...(byCell.get(pick.index) ?? []), pick]);
  }
  const markers = new Map<number, { outcome: PickOutcome; initials: string }>();
  for (const [index, cellPicks] of byCell) {
    const outcome: PickOutcome = cellPicks.some((pick) => pick.hitMine)
      ? 'mine'
      : cellPicks.every((pick) => pick.autoPlayed)
        ? 'auto'
        : 'safe';
    markers.set(index, {
      outcome,
      initials:
        cellPicks.length > 1
          ? `×${cellPicks.length}`
          : initialsOf(cellPicks[0].username),
    });
  }
  return markers;
}
