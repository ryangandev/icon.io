import type { GameInfo } from '../games/catalog';
import { useMessages, type Messages } from '../i18n';
import { PageHeading, type PageHeadingProps } from '../shell/page-heading';

/** The pages on the way into a room share one heading on a wide screen. */
export function lobbyHeading(
  game: GameInfo,
  subtitle: string,
  m: Messages,
): PageHeadingProps {
  return {
    eyebrow: m.lobby.playTogether,
    title: m.lobby.title(m.games.of[game.type].name),
    subtitle,
  };
}

export function LobbyHeading({
  game,
  subtitle,
}: {
  game: GameInfo;
  subtitle: string;
}) {
  const m = useMessages();
  return <PageHeading {...lobbyHeading(game, subtitle, m)} />;
}
