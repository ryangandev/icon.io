import { Button, Card } from '../ui';
import { useCopy } from '../shell/use-copy';
import styles from './challenge.module.css';

/** The whole address of a challenge: the same game, for somebody else. */
export const challengeLink = (path: string, seed: string) =>
  `${window.location.origin}${path}?seed=${seed}`;

/** Challenge a friend, among a finished game's actions (T05, PR04). */
export function ChallengeButton({ link }: { link: string }) {
  const { copied, copy } = useCopy(link);
  return (
    <Button variant="secondary" icon={copied ? 'check' : 'link'} onClick={copy}>
      {copied ? 'Link copied' : 'Challenge a friend'}
    </Button>
  );
}

/** The card beside a finished game with the same link (T05, PR04). */
export function ChallengeCard({
  description,
  link,
}: {
  /** "They get these same ten hands and try to beat 2:41." */
  description: string;
  link: string;
}) {
  const { copied, copy } = useCopy(link);
  return (
    <Card kind="panel" title="Challenge a friend" description={description}>
      <Button
        className={styles.copy}
        variant="secondary"
        icon={copied ? 'check' : 'link'}
        onClick={copy}
      >
        {copied ? 'Link copied' : 'Copy challenge link'}
      </Button>
    </Card>
  );
}
