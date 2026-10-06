import { useMessages } from '../../i18n';
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
  disabled?: boolean;
  className?: string;
}

/**
 * Zumpo/Keyboard: QWERTY, with Enter and Delete on the bottom row. It takes
 * the Phone layout, smaller keys closer together, when its container is
 * narrower than the Desktop one.
 */
export function Keyboard({
  marks = {},
  onLetter,
  onEnter,
  onDelete,
  disabled,
  className,
}: KeyboardProps) {
  const m = useMessages();
  return (
    <div className={cx(styles.container, className)}>
      <div
        role="group"
        aria-label={m.ui.word.keyboard}
        className={styles.keyboard}
      >
        {ROWS.map((letters, row) => (
          <div key={letters} className={styles.row}>
            {row === 2 && (
              <LetterKey kind="enter" onPress={onEnter} disabled={disabled} />
            )}
            {[...letters].map((letter) => (
              <LetterKey
                key={letter}
                letter={letter}
                state={marks[letter] ?? 'plain'}
                onPress={() => onLetter(letter)}
                disabled={disabled}
              />
            ))}
            {row === 2 && (
              <LetterKey kind="delete" onPress={onDelete} disabled={disabled} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
