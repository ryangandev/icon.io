import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, DialogClose, TextField } from '../ui';
import styles from './dialogs.module.css';

/** P11: leaving mid-game costs the seat and the score, so it asks first. */
export function LeaveDialog({
  open,
  roomName,
  points,
  onStay,
  onLeave,
}: {
  open: boolean;
  roomName: string;
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
      description={`The game carries on without you, and your seat and your ${points} points go with you. You can join again while a seat is open.`}
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
