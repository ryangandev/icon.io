import { ButtonLink, Notice } from '../ui';
import { GameCard, GameCards } from '../games/game-card';
import { GAMES, lobbyPath } from '../games/catalog';
import { Page } from '../shell/page';
import { PageHeading } from '../shell/page-heading';
import { PHONE, useMediaQuery } from '../shell/use-media-query';
import { namePath } from './name';
import styles from './home.module.css';

/** P01 and MO01: the front door. Every way in goes through the name page. */
export default function HomePage() {
  // A phone keeps one way in and shorter copy, so the games show sooner.
  const phone = useMediaQuery(PHONE);
  return (
    <Page>
      <PageHeading
        eyebrow={phone ? 'A little play' : 'A little play goes a long way'}
        title={'A little play.\nA lot of fun.'}
        subtitle={
          phone
            ? 'Good games for good company.'
            : 'Draw, guess, and take a little risk. Good games for good company.'
        }
        hero
      />
      <div className={styles.actions}>
        <ButtonLink to={namePath('/games')}>Let’s play</ButtonLink>
        {!phone && (
          <ButtonLink to={namePath('/games')} variant="secondary">
            Browse games
          </ButtonLink>
        )}
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
      {!phone && (
        <Notice>Grab a friend. Both games start with 2 players.</Notice>
      )}
    </Page>
  );
}
