import { GameCard, GameCards } from '../games/game-card';
import { GAMES, lobbyPath } from '../games/catalog';
import { countWord } from '../games/plural';
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
            ? `${countWord(GAMES.length)} little games, alone or together.`
            : `${countWord(GAMES.length)} little games. Play on your own, or bring some good company.`
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
