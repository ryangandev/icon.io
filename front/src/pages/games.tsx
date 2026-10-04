import { GameCard, GameCards } from '../games/game-card';
import { GAMES, lobbyPath } from '../games/catalog';
import { useSession } from '../net/session';
import { Page } from '../shell/page';
import { PageHeading } from '../shell/page-heading';
import { PHONE, useMediaQuery } from '../shell/use-media-query';

/** P04 and MO03: choose a game. */
export default function GamesPage() {
  const { name } = useSession();
  const phone = useMediaQuery(PHONE);
  return (
    <Page>
      <PageHeading
        eyebrow={phone ? `Hey, ${name}` : `Welcome back, ${name}`}
        title="What are we playing?"
        subtitle={
          phone
            ? 'Good games for good company.'
            : 'Two little games. Plenty of ways to surprise each other.'
        }
      />
      <GameCards>
        {GAMES.map((game) => (
          <GameCard key={game.type} game={game} to={lobbyPath(game.type)} />
        ))}
      </GameCards>
    </Page>
  );
}
