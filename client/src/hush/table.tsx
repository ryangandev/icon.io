import type { ReactNode } from 'react';
import type { HushDiscard, HushPlay } from '../../../shared/wire-types';
import { HushCard, Lives } from '../ui';
import styles from './table.module.css';

/** The paper panel a level is played on, and the last pile is left on. */
export function TablePanel({ children }: { children: ReactNode }) {
  return <div className={styles.panel}>{children}</div>;
}

/** "Level 3 · 3 cards each", or "The pile · 8 cards to go", and the lives. */
export function TableHead({
  title,
  note,
  lives,
}: {
  title: string;
  note?: string;
  lives: number;
}) {
  return (
    <div className={styles.head}>
      <p className={styles.titleGroup}>
        <span className={styles.title}>{title}</span>
        {note && <span className={styles.note}>{note}</span>}
      </p>
      <Lives lives={lives} />
    </div>
  );
}

/**
 * The pile: its top card large, and under it every card below, played or
 * discarded, lowest first. Before the first play, a place for it.
 */
export function Pile({
  pile,
  discards,
  empty,
}: {
  pile: readonly HushPlay[];
  discards: readonly HushDiscard[];
  /** What the empty place says. */
  empty: string;
}) {
  const top = pile.at(-1);
  const under = [
    ...pile.slice(0, -1).map(({ card }) => ({ card, discarded: false })),
    ...discards.map(({ card }) => ({ card, discarded: true })),
  ].toSorted((a, b) => a.card - b.card);
  return (
    <section className={styles.pile} aria-label="The pile">
      {top ? (
        <HushCard value={top.card} state="pile" size="large" />
      ) : (
        <p className={styles.empty}>{empty}</p>
      )}
      {under.length > 0 && (
        <ol className={styles.trail} aria-label="Under the top card">
          {under.map(({ card, discarded }) => (
            <li key={card}>
              <HushCard
                value={card}
                state={discarded ? 'discarded' : 'played'}
                size="small"
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * The viewer's side of the table: their cards or a message, and what they
 * can do, or what happens next.
 */
export function HandRow({
  label,
  cards,
  message,
  action,
  status,
}: {
  label: string;
  /** Lowest first; the first is the next to play. */
  cards?: readonly number[];
  message?: string;
  /** The one button, when there is something to do. */
  action?: ReactNode;
  status?: string;
}) {
  return (
    <div className={styles.handRow}>
      <section className={styles.hand} aria-label={label}>
        <h2 className={styles.label}>{label}</h2>
        {cards && cards.length > 0 && (
          <ol className={styles.cards}>
            {cards.map((card, index) => (
              <li key={card}>
                <HushCard value={card} state={index === 0 ? 'next' : 'hand'} />
              </li>
            ))}
          </ol>
        )}
        {message && <p className={styles.message}>{message}</p>}
      </section>
      {(action || status) && (
        <div className={styles.action}>
          {action}
          {status && (
            <p className={action ? styles.smallStatus : styles.status}>
              {status}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function Divider() {
  return <hr className={styles.divider} />;
}
