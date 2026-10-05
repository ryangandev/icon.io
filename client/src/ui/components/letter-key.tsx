import { cx } from '../cx';
import { Icon } from './icon';
import { MARK_WORDS } from './letter-tile';
import styles from './letter-key.module.css';

export type LetterKeyState = 'plain' | 'correct' | 'present' | 'absent';

export interface LetterKeyProps {
  kind?: 'letter' | 'enter' | 'delete';
  /** The letter of a letter key. */
  letter?: string;
  /** The best mark the letter has had so far; plain when unused. */
  state?: LetterKeyState;
  /**
   * Regular is 40 × 56; Compact, 30 × 44, is for a phone, and a Regular key
   * becomes Compact in a container narrower than the Desktop keyboard.
   */
  size?: 'regular' | 'compact';
  onPress: () => void;
  disabled?: boolean;
}

/**
 * Zumpo/Letter key: one key of the on-screen keyboard, with the tile's shapes:
 * a square for the right place, a pill for somewhere else, flat grey for not
 * in the word.
 */
export function LetterKey({
  kind = 'letter',
  letter = '',
  state = 'plain',
  size = 'regular',
  onPress,
  disabled,
}: LetterKeyProps) {
  const shown = letter.toUpperCase();
  const label =
    kind === 'enter'
      ? 'Enter'
      : kind === 'delete'
        ? 'Delete letter'
        : state === 'plain'
          ? shown
          : `${shown}, ${MARK_WORDS[state]}`;
  return (
    <button
      type="button"
      aria-label={label}
      className={cx(
        styles.key,
        size === 'compact' && styles.compact,
        kind !== 'letter' && styles.wide,
        styles[state],
      )}
      disabled={disabled}
      // A click keeps the focus where it was, so a real keyboard's Enter
      // submits the row rather than pressing this key again.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPress}
    >
      {kind === 'delete' ? (
        <Icon glyph="back" size={20} />
      ) : (
        <span
          className={kind === 'enter' ? styles.word : styles.letter}
          aria-hidden="true"
        >
          {kind === 'enter' ? 'Enter' : shown}
        </span>
      )}
    </button>
  );
}
