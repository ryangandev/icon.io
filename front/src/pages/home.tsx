import { ButtonLink, Notice } from '../ui';
import { GameCard, GameCards } from '../games/game-card';
import { GAMES, lobbyPath } from '../games/catalog';
import { Page } from '../shell/page';
import { PageHeading } from '../shell/page-heading';
import { namePath } from './name';
import styles from './home.module.css';

/** P01: the front door. Every way in goes through the name page. */
export default function HomePage() {
  return (
    <Page>
      <PageHeading
        eyebrow="A little play goes a long way"
        title={'A little play.\nA lot of fun.'}
        subtitle="Draw, guess, and take a little risk. Good games for good company."
        hero
      />
      <div className={styles.actions}>
        <ButtonLink to={namePath('/games')}>Let’s play</ButtonLink>
        <ButtonLink to={namePath('/games')} variant="secondary">
          Browse games
        </ButtonLink>
      </div>
      <GameCards>
        {GAMES.map((game) => (
          <GameCard
            key={game.type}
            game={game}
            to={namePath(lobbyPath(game.type))}
          />
        ))}
      </GameCards>
      <Notice>Grab a friend. Both games start with 2 players.</Notice>
    </Page>
  );
}
