import { ButtonLink, Tag } from '../ui';
import { cx } from '../ui/cx';
import { useMessages } from '../i18n';
import { GameArtwork } from './artwork';
import { lobbyPath, soloPath, type GameInfo } from './catalog';
import styles from './game-card.module.css';

/**
 * Zumpo/Game card: a game on the home page, what it is and the ways in. A tile
 * sits four across on a desktop; a row lists it on a phone, with the game's
 * signature piece as its icon.
 */
export function GameCard({
  game,
  layout,
}: {
  game: GameInfo;
  layout: 'tile' | 'row';
}) {
  const text = useMessages().games.of[game.type];
  const copy = (
    <div className={styles.copy}>
      <h3 id={`game-${game.type}`} className={styles.name}>
        {text.name}
      </h3>
      <p className={styles.tagline}>
        {(layout === 'row' && text.rowTagline) || text.tagline}
      </p>
      {layout === 'row' && <Tag tone="paper">{text.facts}</Tag>}
    </div>
  );
  return (
    <section
      className={cx(styles.card, styles[layout], styles[game.tone])}
      aria-labelledby={`game-${game.type}`}
    >
      {layout === 'tile' ? (
        <>
          <GameArtwork type={game.type} size="tile" />
          {copy}
          <Tag tone="paper">{text.facts}</Tag>
        </>
      ) : (
        <div className={styles.top}>
          <GameArtwork type={game.type} size="icon" />
          {copy}
        </div>
      )}
      <GameWaysIn game={game} className={styles.waysIn} />
    </section>
  );
}

/**
 * The ways into a game, on its card and beside its rules: Play solo first when
 * it has one, then Find a room.
 */
export function GameWaysIn({
  game,
  className,
}: {
  game: GameInfo;
  className?: string;
}) {
  const m = useMessages();
  const to = lobbyPath(game.type);
  if (!game.solo) {
    return (
      <ButtonLink to={to} className={className}>
        {m.games.findRoom}
      </ButtonLink>
    );
  }
  return (
    <div className={cx(styles.actions, className)}>
      <ButtonLink to={soloPath(game.type)}>{m.games.playSolo}</ButtonLink>
      <ButtonLink to={to} variant="secondary">
        {m.games.findRoom}
      </ButtonLink>
    </div>
  );
}
