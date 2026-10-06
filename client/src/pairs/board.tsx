import type { ReactNode } from 'react';
import { PairsCard, type PairsCardState } from '../ui';
import { cx } from '../ui/cx';
import { PHONE, useMediaQuery } from '../shell/use-media-query';
import { useMessages } from '../i18n';
import styles from './board.module.css';

export interface PairsGridProps {
  /** Every card in its place, row by row, on a square board. */
  cards: readonly PairsCardState[];
  /** Set while a face-down card may be turned over. */
  onFlip?: (index: number) => void;
}

/**
 * A Pairs board, in a room or on your own. On a phone a 6 × 6 board uses
 * compact cards, so it fits without panning.
 */
export function PairsGrid({ cards, onFlip }: PairsGridProps) {
  const m = useMessages();
  const phone = useMediaQuery(PHONE);
  const side = Math.round(Math.sqrt(cards.length));
  const size = phone && side > 4 ? 'compact' : 'regular';
  const rows = Array.from({ length: side }, (_, row) =>
    cards.slice(row * side, (row + 1) * side),
  );
  return (
    <div
      className={cx(styles.board, size === 'compact' && styles.compact)}
      role="grid"
      aria-label={m.pairs.cards}
    >
      {rows.map((row, r) => (
        <div key={r} className={styles.row} role="row">
          {row.map((card, c) => {
            const index = r * side + c;
            return (
              <PairsCard
                key={index}
                state={card}
                size={size}
                row={r}
                column={c}
                onPick={onFlip ? () => onFlip(index) : undefined}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** The paper panel a board is played on; bare on a phone. */
export function BoardPanel({ children }: { children: ReactNode }) {
  return <div className={styles.panel}>{children}</div>;
}
