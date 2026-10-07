import { ButtonLink } from '../ui';
import { cx } from '../ui/cx';
import { GAMES } from '../games/catalog';
import { GameWaysIn } from '../games/game-card';
import { useMessages } from '../i18n';
import { Page } from '../shell/page';
import { PageHeading } from '../shell/page-heading';
import styles from './how-to-play.module.css';

/** P14: every game's rules on one page, each with its ways in. */
export default function HowToPlayPage() {
  const m = useMessages();
  return (
    <Page>
      <PageHeading
        eyebrow={m.howToPlay.eyebrow}
        title={m.howToPlay.title}
        subtitle={m.howToPlay.subtitle}
      />
      <div className={styles.games}>
        {GAMES.map((game) => (
          <section
            key={game.type}
            className={cx(styles.game, styles[game.tone])}
            aria-labelledby={`rules-${game.type}`}
          >
            <h2 id={`rules-${game.type}`} className={styles.name}>
              {m.games.of[game.type].name}
            </h2>
            <p className={styles.rules}>{m.games.of[game.type].rules}</p>
            <GameWaysIn game={game} className={styles.action} />
          </section>
        ))}
      </div>
      <div>
        <ButtonLink to="/" variant="secondary" icon="back">
          {m.shell.backToGames}
        </ButtonLink>
      </div>
    </Page>
  );
}
