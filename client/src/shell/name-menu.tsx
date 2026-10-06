import { useState, type ReactNode } from 'react';
import {
  Button,
  NameMenu,
  NameMenuForm,
  NameMenuHint,
  type ButtonVariant,
  type ViewerMenu,
} from '../ui';
import { useSession } from '../net/session';
import { readNameHintSeen, writeNameHintSeen } from '../net/storage';
import { randomName } from '../players/random-name';

/**
 * The name in a field, saved for this browser and every seat. Mounted with
 * the menu's popup, so it opens with the current name every time.
 */
function NameForm({ onSaved }: { onSaved: () => void }) {
  const { name, setName } = useSession();
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string>();

  return (
    <NameMenuForm
      value={value}
      onValueChange={(next) => {
        setValue(next);
        if (error && next.trim()) setError(undefined);
      }}
      error={error}
      onSave={() => {
        const chosen = value.trim();
        if (!chosen) {
          setError('Enter a name with at least one visible character.');
          return false;
        }
        // Always sent: the picked name saved unchanged becomes theirs, and a
        // seat still under an older name, such as another tab's, catches up.
        setName(chosen);
        onSaved();
        return true;
      }}
      onRoll={() => {
        setValue(randomName(value.trim()));
        setError(undefined);
      }}
    />
  );
}

/**
 * The menu the viewer's avatar opens. With `hint`, a first visit opens it by
 * itself to say which name was picked (P02); any way of closing that, or a
 * name of their own, means it is never shown again.
 */
export function useViewerMenu({ hint = false } = {}): ViewerMenu {
  const { name, namePicked } = useSession();
  const [hinting, setHinting] = useState(
    () => hint && namePicked && !readNameHintSeen(),
  );
  const [open, setOpen] = useState(hinting);

  const onOpenChange = (next: boolean) => {
    if (next) {
      // Opened from the avatar: always the form.
      setHinting(false);
    } else if (hinting) {
      writeNameHintSeen();
    }
    setOpen(next);
  };

  return {
    open,
    onOpenChange,
    label: hinting ? undefined : 'Your name',
    children: hinting ? (
      <NameMenuHint
        name={name}
        onDismiss={() => onOpenChange(false)}
        onChange={() => {
          writeNameHintSeen();
          setHinting(false);
        }}
      />
    ) : (
      <NameForm onSaved={() => setOpen(false)} />
    ),
  };
}

/**
 * A button that opens the name menu under itself: Playing as in a lobby
 * (DL01, MO04), Change name in a waiting room (P19).
 */
export function NameMenuButton({
  variant = 'secondary',
  className,
  children,
}: {
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <NameMenu
      open={open}
      onOpenChange={setOpen}
      align="start"
      label="Your name"
      trigger={
        <Button variant={variant} icon="edit" className={className}>
          {children}
        </Button>
      }
    >
      <NameForm onSaved={() => setOpen(false)} />
    </NameMenu>
  );
}
