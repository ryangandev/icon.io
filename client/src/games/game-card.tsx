import type { ReactNode } from 'react';
import { PHONE, useMediaQuery } from '../shell/use-media-query';
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
  const phone = useMediaQuery(PHONE);
  return (
    <section
      className={cx(styles.card, styles[game.tone])}
      aria-labelledby={`game-${game.type}`}
    >
      <h2 id={`game-${game.type}`} className={styles.name}>
        {game.name}
      </h2>
      <p className={styles.tagline}>
        {(phone && game.phoneTagline) || game.tagline}
      </p>
      <Tag tone="paper">{game.facts}</Tag>
      <GameArtwork type={game.type} />
      <GameWaysIn game={game} to={to} />
    </section>
  );
}

/**
 * The ways into a game, on its card and beside its rules: Play solo first when
 * it has one, then Find a room.
 */
export function GameWaysIn({
  game,
  to,
  className,
}: {
  game: GameInfo;
  to: string;
  className?: string;
}) {
  if (!game.solo) {
    return (
      <ButtonLink to={to} className={className}>
        Find a room
      </ButtonLink>
    );
  }
  return (
    <div className={cx(styles.actions, className)}>
      <ButtonLink to={soloPath(game.type)}>Play solo</ButtonLink>
      <ButtonLink to={to} variant="secondary">
        Find a room
      </ButtonLink>
    </div>
  );
}

/** The game cards two by two, stacked on a phone. */
export function GameCards({ children }: { children: ReactNode }) {
  return <div className={styles.cards}>{children}</div>;
}
