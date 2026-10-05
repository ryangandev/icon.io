import { Button, ButtonLink, Card } from '../ui';
import { useSession } from '../net/session';

/**
 * The connection is gone until the player acts: the server never answered
 * (P06, "Try again"), or another tab with this player's identity took over,
 * a duplicated tab most likely, and this one waits to be chosen again.
 */
export function ConnectionLost() {
  const { status, connect } = useSession();
  const replaced = status === 'replaced';
  return (
    <Card
      title={
        replaced
          ? 'Zumpo is open in another tab.'
          : 'We couldn’t get connected.'
      }
      description={
        replaced
          ? 'You’re playing there now. Use this tab instead, and the other one will wait.'
          : 'The game server didn’t respond. Please try again.'
      }
      actions={
        <>
          <Button onClick={connect}>
            {replaced ? 'Use this tab' : 'Try again'}
          </Button>
          <ButtonLink to="/games" variant="secondary" icon="back">
            Back to games
          </ButtonLink>
        </>
      }
    />
  );
}
