import { useRef } from 'react';
import { Button, Dialog, DialogClose, TextField } from '../ui';
import type { GameInfo } from '../games/catalog';
import { useCopy } from '../shell/use-copy';
import styles from './dialogs.module.css';

/**
 * P11, P16: leaving asks first. Mid-game it costs the seat and the score
 * (P11); between games only the seat, for a way out other than Leave room
 * (P16).
 */
export function LeaveDialog({
  open,
  roomName,
  inGame,
  score,
  onStay,
  onLeave,
}: {
  open: boolean;
  roomName: string;
  inGame: boolean;
  /** "180 points", "3 pairs". */
  score: string;
  onStay: () => void;
  onLeave: () => void;
}) {
  const stay = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onStay();
      }}
      title={`Leave ${roomName}?`}
      description={
        inGame
          ? `The game carries on without you, and your seat and your ${score} go with you. You can join again while a seat is open.`
          : 'Your seat goes with you. You can join again while a seat is open.'
      }
      initialFocus={stay}
      actions={
        <>
          <Button variant="danger" icon="leave" onClick={onLeave}>
            Leave room
          </Button>
          <Button ref={stay} variant="secondary" onClick={onStay}>
            Stay
          </Button>
        </>
      }
    />
  );
}

/** P15: the game's rules over the room, which carries on behind them. */
export function RulesDialog({
  open,
  onOpenChange,
  game,
  solo = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: GameInfo;
  /** The rules of the game on your own rather than in a room. */
  solo?: boolean;
}) {
  const rules =
    solo && game.solo
      ? game.solo
      : { summary: game.lobbySummary, facts: game.lobbyFacts };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`How to play ${game.name}`}
      description={rules.summary}
      actions={<DialogClose render={<Button>Back to the game</Button>} />}
    >
      <ul className={styles.facts}>
        {rules.facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
    </Dialog>
  );
}

/** P12: the room's link, to copy and send to friends. */
export function InviteDialog({
  open,
  onOpenChange,
  roomName,
  link,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomName: string;
  link: string;
}) {
  const { copied, copy } = useCopy(link);
  // Opening on Copy keeps the link whole on screen, rather than selected and
  // scrolled to its end, and makes Enter copy it.
  const copyButton = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Invite friends"
      description={`Anyone with this link can join ${roomName} while a seat is open.`}
      initialFocus={copyButton}
      actions={
        <>
          <Button
            ref={copyButton}
            icon={copied ? 'check' : 'copy'}
            onClick={copy}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <DialogClose render={<Button variant="secondary">Done</Button>} />
        </>
      }
    >
      <TextField
        label="Room link"
        value={link}
        readOnly
        // Figma wraps the link over two lines; a phone needs three.
        render={<textarea rows={2} className={styles.link} />}
        onFocus={(event) => event.currentTarget.select()}
      />
    </Dialog>
  );
}
