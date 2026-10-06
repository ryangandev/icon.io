import { Notice } from '../ui';
import { GameList } from '../games/game-list';
import { HeroArt } from '../games/hero-art';
import { Page } from '../shell/page';
import { PageHeading } from '../shell/page-heading';
import { PHONE, useMediaQuery } from '../shell/use-media-query';
import styles from './home.module.css';

/**
 * P01 and MO01: the front door, and the one page that lists every game, so a
 * game is one click from arriving.
 */
export default function HomePage() {
  // A phone keeps shorter copy, so the games show sooner.
  const phone = useMediaQuery(PHONE);
  return (
    <Page nameHint>
      <div className={styles.hero}>
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
        {!phone && <HeroArt className={styles.art} />}
      </div>
      <GameList />
      {!phone && (
        <Notice>
          Play solo starts at once. Rooms start with 2 players, so grab a
          friend.
        </Notice>
      )}
    </Page>
  );
}
