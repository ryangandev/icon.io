import type { ReactNode } from 'react';
import { TriosCard, type TriosCardState } from '../ui';
import { PHONE, useMediaQuery } from '../shell/use-media-query';
import styles from './table.module.css';

/** What one place on the table shows, beyond its card. */
export interface PlaceView {
  state?: TriosCardState;
  /** "Hint", or the initials of who found it. */
  badge?: string;
  /** The badge's meaning, for the card's accessible name. */
  badgeLabel?: string;
}

export interface TriosTableProps {
  /** The twelve cards in their places, row by row. */
  cards: readonly number[];
  /** Each place's state and badge, by place. */
  places?: Readonly<Record<number, PlaceView>>;
  /** Set while cards may be picked: picks or puts back the card at a place. */
  onPick?: (place: number) => void;
}

/**
 * The twelve cards: four columns of three on a desktop, three columns of four
 * compact cards on a phone, in the same order, so nothing moves while you
 * look.
 */
export function TriosTable({ cards, places = {}, onPick }: TriosTableProps) {
  const phone = useMediaQuery(PHONE);
  return (
    <div className={styles.table} role="group" aria-label="Table">
      {cards.map((card, place) => (
        <TriosCard
          key={place}
          card={card}
          size={phone ? 'compact' : 'regular'}
          {...places[place]}
          onPick={onPick ? () => onPick(place) : undefined}
        />
      ))}
    </div>
  );
}

/** The paper panel the table sits on; bare on a phone. */
export function TablePanel({ children }: { children: ReactNode }) {
  return <div className={styles.panel}>{children}</div>;
}

/** A trio in a line of mini cards: the last one taken, or one of a run. */
export function MiniTrio({ cards }: { cards: readonly number[] }) {
  return (
    <span className={styles.mini}>
      {cards.map((card) => (
        <TriosCard key={card} card={card} size="mini" />
      ))}
    </span>
  );
}

/** TS05-TS09: the latest trio taken, so a player who looked away sees it. */
export function LastTrio({
  finder,
  cards,
}: {
  finder: string;
  cards: readonly number[];
}) {
  return (
    <div className={styles.lastTrio}>
      <span className={styles.lastLabel}>Last trio: {finder}</span>
      <MiniTrio cards={cards} />
    </div>
  );
}

/** The row under the table, for Hint. */
export function TableTools({ children }: { children: ReactNode }) {
  return <div className={styles.tools}>{children}</div>;
}
