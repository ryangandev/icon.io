import { GameCard, GameCards } from '../games/game-card';
import { GAMES, lobbyPath } from '../games/catalog';
import { useSession } from '../net/session';
import { Page } from '../shell/page';
import { PageHeading } from '../shell/page-heading';

/** P04: choose a game. */
export default function GamesPage() {
  const { name } = useSession();
  return (
    <Page>
      <PageHeading
        eyebrow={`Welcome back, ${name}`}
        title="What are we playing?"
        subtitle="Two little games. Plenty of ways to surprise each other."
      />
      <GameCards>
        {GAMES.map((game) => (
          <GameCard key={game.type} game={game} to={lobbyPath(game.type)} />
        ))}
      </GameCards>
    </Page>
  );
}
