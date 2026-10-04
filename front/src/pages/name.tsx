import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button, ButtonLink, TextField } from '../ui';
import { useSession } from '../net/session';
import { FormPage } from '../shell/form-page';
import { PHONE, useMediaQuery } from '../shell/use-media-query';

/** The server's limit on a name. */
export const NAME_MAX_LENGTH = 18;

/** The name page, set to continue to `next` once the player has a name. */
export function namePath(next: string): string {
  return `/name?next=${encodeURIComponent(next)}`;
}

/** Only a path inside this app, so a crafted link cannot send a player away. */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//')
    ? next
    : '/games';
}

/** P02, P03 and MO02: the name everyone else will see. */
export default function NamePage() {
  const { name, setName } = useSession();
  // A phone gives up the subtitle that promises no signup; the helper keeps it.
  const phone = useMediaQuery(PHONE);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [value, setValue] = useState(name);
  const [invalid, setInvalid] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setInvalid(true);
      return;
    }
    setName(trimmed);
    navigate(safeNext(params.get('next')), { replace: true });
  };

  return (
    <FormPage
      heading={{
        eyebrow: 'Come on in',
        title: 'Every good game starts with a name.',
        subtitle: 'No signup. Just pick a name your friends will recognize.',
      }}
      phone={{
        eyebrow: 'Come on in',
        subtitle: 'A little step before the fun.',
      }}
      title="What should we call you?"
      description="Your name will appear in rooms, chat, and scores."
      onSubmit={submit}
      actions={
        <>
          <Button type="submit">Let’s play</Button>
          <ButtonLink to="/" variant="secondary" icon="back">
            Back home
          </ButtonLink>
        </>
      }
    >
      <TextField
        label="Your name"
        helper={`Up to ${NAME_MAX_LENGTH} characters.${phone ? ' No signup.' : ''}`}
        error={
          invalid
            ? 'Enter a name with at least one visible character.'
            : undefined
        }
        value={value}
        onValueChange={(next: string) => {
          setValue(next);
          if (invalid && next.trim()) setInvalid(false);
        }}
        maxLength={NAME_MAX_LENGTH}
        autoComplete="nickname"
        autoFocus
        name="name"
      />
    </FormPage>
  );
}
