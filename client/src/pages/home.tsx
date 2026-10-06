import { ButtonLink, Notice } from '../ui';
import { GameCard, GameCards } from '../games/game-card';
import { GAMES, lobbyPath } from '../games/catalog';
import { Page } from '../shell/page';
import { PageHeading } from '../shell/page-heading';
import { PHONE, useMediaQuery } from '../shell/use-media-query';
import styles from './home.module.css';

/**
 * P01 and MO01: the front door. A first visit is asked for a name on the way
 * in, by the pages that need one.
 */
export default function HomePage() {
  // A phone keeps one way in and shorter copy, so the games show sooner.
  const phone = useMediaQuery(PHONE);
  return (
    <Page nameHint>
      <PageHeading
        eyebrow={phone ? 'A little play' : 'A little play goes a long way'}
        title={'A little play.\nA lot of fun.'}
        subtitle={
          phone
            ? 'Good games for good company.'
            : 'Draw, guess, spot, bluff and remember. On your own, or with good company.'
        }
        hero
      />
      <div className={styles.actions}>
        <ButtonLink to={'/games'}>Let’s play</ButtonLink>
        {!phone && (
          <ButtonLink to={'/games'} variant="secondary">
            Browse games
          </ButtonLink>
        )}
      </div>
      <GameCards>
        {GAMES.map((game) => (
          <GameCard key={game.type} game={game} to={lobbyPath(game.type)} />
        ))}
      </GameCards>
      {!phone && (
        <Notice>
          Play solo starts at once. Rooms start with 2 players, so grab a
          friend.
        </Notice>
      )}
    </Page>
  );
}
