import type { ReactNode } from 'react';
import { ButtonLink, Tag } from '../ui';
import { cx } from '../ui/cx';
import { GameArtwork } from './artwork';
import { soloPath, type GameInfo } from './catalog';
import styles from './game-card.module.css';

/**
 * A game on the home and games pages: what it is, and the ways in. Play solo
 * starts at once; Find a room is the game's room list.
 */
export function GameCard({ game, to }: { game: GameInfo; to: string }) {
  return (
    <section
      className={cx(styles.card, styles[game.tone])}
      aria-labelledby={`game-${game.type}`}
    >
      <h2 id={`game-${game.type}`} className={styles.name}>
        {game.name}
      </h2>
      <p className={styles.tagline}>{game.tagline}</p>
      <Tag tone="paper">{game.facts}</Tag>
      <GameArtwork type={game.type} />
      {game.solo ? (
        <div className={styles.actions}>
          <ButtonLink to={soloPath(game.type)}>Play solo</ButtonLink>
          <ButtonLink to={to} variant="secondary">
            Find a room
          </ButtonLink>
        </div>
      ) : (
        <ButtonLink to={to}>Find a room</ButtonLink>
      )}
    </section>
  );
}

/** The game cards two by two, stacked on a phone. */
export function GameCards({ children }: { children: ReactNode }) {
  return <div className={styles.cards}>{children}</div>;
}
