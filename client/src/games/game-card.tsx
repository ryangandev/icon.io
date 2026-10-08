import { Link } from 'react-router';
import { ButtonLink, Icon, Tag } from '../ui';
import { cx } from '../ui/cx';
import { useMessages } from '../i18n';
import { GameArtwork } from './artwork';
import { gamePath, soloPath, type GameInfo } from './catalog';
import styles from './game-card.module.css';

/**
 * Zumpo/Game card: a game on the home page, what it is and how many can play,
 * the whole card a link to the game's page, where you pick how to play it. A
 * tile sits four across on a desktop; a row lists it on a phone, with the
 * game's signature piece as its icon.
 */
export function GameCard({
  game,
  layout,
}: {
  game: GameInfo;
  layout: 'tile' | 'row';
}) {
  const text = useMessages().games.of[game.type];
  const id = `game-${game.type}`;
  const facts = (
    <Tag tone="paper" id={`${id}-facts`}>
      {text.facts}
    </Tag>
  );
  const copy = (
    <div className={styles.copy}>
      <h3 id={id} className={styles.name}>
        {text.name}
      </h3>
      <p id={`${id}-tagline`} className={styles.tagline}>
        {(layout === 'row' && text.rowTagline) || text.tagline}
      </p>
      {layout === 'row' && facts}
    </div>
  );
  return (
    // The name is the link's name; the tagline and facts describe it, so a
    // screen reader does not read the whole card as one name.
    <Link
      to={gamePath(game.type)}
      className={cx(styles.card, styles[layout], styles[game.tone])}
      aria-labelledby={id}
      aria-describedby={`${id}-tagline ${id}-facts`}
    >
      {layout === 'tile' ? (
        <>
          <GameArtwork type={game.type} size="tile" />
          {copy}
          <div className={styles.footer}>
            {facts}
            <span className={styles.go} aria-hidden="true">
              <Icon glyph="forward" size={20} />
            </span>
          </div>
        </>
      ) : (
        <div className={styles.top}>
          <GameArtwork type={game.type} size="icon" />
          {copy}
          <span className={styles.arrow} aria-hidden="true">
            <Icon glyph="forward" size={20} />
          </span>
        </div>
      )}
    </Link>
  );
}

/**
 * The ways into a game beside its rules: Play solo first when it has one, then
 * Find a room on the game's page.
 */
export function GameWaysIn({
  game,
  className,
}: {
  game: GameInfo;
  className?: string;
}) {
  const m = useMessages();
  const to = gamePath(game.type);
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
