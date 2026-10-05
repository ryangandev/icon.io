import { Button, ButtonLink, Card } from '../ui';
import { useSession } from '../net/session';

/** P06: the server never answered. "Try again" starts the connection over. */
export function ConnectionFailed() {
  const { connect } = useSession();
  return (
    <Card
      title="We couldn’t get connected."
      description="The game server didn’t respond. Please try again."
      actions={
        <>
          <Button onClick={connect}>Try again</Button>
          <ButtonLink to="/games" variant="secondary" icon="back">
            Back to games
          </ButtonLink>
        </>
      }
    />
  );
}
