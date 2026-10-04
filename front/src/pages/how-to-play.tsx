import { ButtonLink } from '../ui';
import { cx } from '../ui/cx';
import { GAMES, lobbyPath } from '../games/catalog';
import { Page } from '../shell/page';
import { PageHeading } from '../shell/page-heading';
import styles from './how-to-play.module.css';

/** P14: every rule of both games, on one page. */
export default function HowToPlayPage() {
  return (
    <Page>
      <PageHeading
        eyebrow="A little help"
        title="Easy to learn. Hard to leave."
        subtitle="Pick a game. A few little rules, then you’re ready."
      />
      <div className={styles.games}>
        {GAMES.map((game) => (
          <section
            key={game.type}
            className={cx(styles.game, styles[game.tone])}
            aria-labelledby={`rules-${game.type}`}
          >
            <h2 id={`rules-${game.type}`} className={styles.name}>
              {game.name}
            </h2>
            <p className={styles.rules}>{game.rules}</p>
            <ButtonLink to={lobbyPath(game.type)} className={styles.action}>
              Find a room
            </ButtonLink>
          </section>
        ))}
      </div>
      <div>
        <ButtonLink to="/games" variant="secondary" icon="back">
          Back to games
        </ButtonLink>
      </div>
    </Page>
  );
}
