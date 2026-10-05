import { LetterKey, type LetterKeyState } from './letter-key';
import { cx } from '../cx';
import styles from './keyboard.module.css';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'] as const;

export interface KeyboardProps {
  /** Each letter's best mark so far, lowercase; a letter not in it is plain. */
  marks?: Readonly<Record<string, Exclude<LetterKeyState, 'plain'>>>;
  onLetter: (letter: string) => void;
  onEnter: () => void;
  onDelete: () => void;
  /** Phone keys are smaller and closer together. */
  layout?: 'desktop' | 'phone';
  disabled?: boolean;
  className?: string;
}

/** Zumpo/Keyboard: QWERTY, with Enter and Delete on the bottom row. */
export function Keyboard({
  marks = {},
  onLetter,
  onEnter,
  onDelete,
  layout = 'desktop',
  disabled,
  className,
}: KeyboardProps) {
  const size = layout === 'phone' ? 'compact' : 'regular';
  return (
    <div
      role="group"
      aria-label="Keyboard"
      className={cx(
        styles.keyboard,
        layout === 'phone' && styles.phone,
        className,
      )}
    >
      {ROWS.map((letters, row) => (
        <div key={letters} className={styles.row}>
          {row === 2 && (
            <LetterKey
              kind="enter"
              size={size}
              onPress={onEnter}
              disabled={disabled}
            />
          )}
          {[...letters].map((letter) => (
            <LetterKey
              key={letter}
              letter={letter}
              state={marks[letter] ?? 'plain'}
              size={size}
              onPress={() => onLetter(letter)}
              disabled={disabled}
            />
          ))}
          {row === 2 && (
            <LetterKey
              kind="delete"
              size={size}
              onPress={onDelete}
              disabled={disabled}
            />
          )}
        </div>
      ))}
    </div>
  );
}
