import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, DialogClose, TextField } from '../ui';
import type { GameInfo } from '../games/catalog';
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
  points,
  onStay,
  onLeave,
}: {
  open: boolean;
  roomName: string;
  inGame: boolean;
  points: number;
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
          ? `The game carries on without you, and your seat and your ${points} points go with you. You can join again while a seat is open.`
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: GameInfo;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`How to play ${game.name}`}
      description={game.lobbySummary}
      actions={<DialogClose render={<Button>Back to the game</Button>} />}
    >
      <ul className={styles.facts}>
        {game.lobbyFacts.map((fact) => (
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
  const [copied, setCopied] = useState(false);
  // Opening on Copy keeps the link whole on screen, rather than selected and
  // scrolled to its end, and makes Enter copy it.
  const copyButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard access can be refused; the link is still there to select.
    }
  };

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
