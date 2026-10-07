import { Button, ButtonLink, Card } from '../ui';
import { useMessages } from '../i18n';
import { useSession } from '../net/session';

/**
 * The connection is gone until the player acts: the server never answered
 * (P06, "Try again"), or another tab with this player's identity took over,
 * a duplicated tab most likely, and this one waits to be chosen again.
 */
export function ConnectionLost() {
  const m = useMessages().shell;
  const { status, connect } = useSession();
  const replaced = status === 'replaced';
  return (
    <Card
      title={replaced ? m.connection.replacedTitle : m.connection.failedTitle}
      description={
        replaced
          ? m.connection.replacedDescription
          : m.connection.failedDescription
      }
      actions={
        <>
          <Button onClick={connect}>
            {replaced ? m.connection.useThisTab : m.connection.tryAgain}
          </Button>
          <ButtonLink to="/" variant="secondary" icon="back">
            {m.backToGames}
          </ButtonLink>
        </>
      }
    />
  );
}
