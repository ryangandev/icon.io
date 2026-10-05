import { useState, type FormEvent } from 'react';
import { cx } from '../cx';
import { Icon } from './icon';
import styles from './chat-input.module.css';

/** The server drops longer messages. */
export const CHAT_MAX_LENGTH = 40;

export interface ChatInputProps {
  onSend: (text: string) => void;
  placeholder?: string;
  /**
   * Why the viewer cannot type, shown in place of the placeholder: the drawer,
   * or someone who already scored this turn.
   */
  lockedReason?: string;
  /** Accessible name of the text box. */
  label?: string;
  className?: string;
}

/** Zumpo/Chat input: the one box for chat and, in Draw & Guess, guesses. */
export function ChatInput({
  onSend,
  placeholder = 'Type a guess or say hi…',
  lockedReason,
  label = 'Message',
  className,
}: ChatInputProps) {
  const [text, setText] = useState('');
  const locked = lockedReason != null;

  function submit(event: FormEvent) {
    event.preventDefault();
    const message = text.trim();
    if (!message || locked) return;
    onSend(message);
    setText('');
  }

  return (
    <form
      className={cx(styles.form, locked && styles.locked, className)}
      onSubmit={submit}
    >
      {locked && <Icon glyph="lock" size={16} />}
      <input
        className={styles.input}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={lockedReason ?? placeholder}
        maxLength={CHAT_MAX_LENGTH}
        disabled={locked}
        aria-label={label}
        autoComplete="off"
        enterKeyHint="send"
      />
      {!locked && (
        <button type="submit" className={styles.send} aria-label="Send">
          <Icon glyph="back" size={16} className={styles.arrow} />
        </button>
      )}
    </form>
  );
}
