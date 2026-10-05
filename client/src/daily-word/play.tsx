import { useEffect, useRef, type ReactNode } from 'react';
import type { DailyWordMark } from '../../../shared/wire-types';
import { keyMarks, WORD_LENGTH } from '../../../shared/daily-word';
import {
  Keyboard,
  MARK_WORDS,
  Notice,
  WordBoard,
  type WordBoardRow,
} from '../ui';
import { PHONE, useMediaQuery } from '../shell/use-media-query';
import { cx } from '../ui/cx';
import styles from './play.module.css';

export interface Typing {
  onLetter: (letter: string) => void;
  onDelete: () => void;
  onEnter: () => void;
}

/**
 * A real keyboard types into the board too: letters, Backspace and Enter,
 * unless a text field has the focus (the chat) or a key comes with Ctrl, Alt
 * or Cmd. Enter on a focused button presses that button, unless letters were
 * typed since the focus came to it: a tab just tapped keeps the focus, and
 * the word typed after it is what Enter is for.
 */
export function useTypingKeys(typing: Typing, enabled: boolean) {
  const latest = useRef(typing);
  useEffect(() => {
    latest.current = typing;
  });
  useEffect(() => {
    if (!enabled) return;
    let typedSinceFocus = false;
    const onFocus = () => {
      typedSinceFocus = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest('input, textarea, select, [role="dialog"]'))
      ) {
        return;
      }
      const onButton =
        target instanceof HTMLElement && target.closest('button, a') !== null;
      if (event.key === 'Enter') {
        if (onButton && !typedSinceFocus) return;
        event.preventDefault();
        latest.current.onEnter();
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        typedSinceFocus = true;
        latest.current.onDelete();
      } else if (/^[a-z]$/i.test(event.key)) {
        typedSinceFocus = true;
        latest.current.onLetter(event.key.toLowerCase());
      }
    };
    window.addEventListener('focusin', onFocus);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('focusin', onFocus);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled]);
}

/** What a checked guess said, for a screen reader: "STARE: S not in the word, …". */
export function describeRow(word: string, marks: readonly DailyWordMark[]) {
  const letters = [...word.toUpperCase()]
    .map((letter, index) => `${letter} ${MARK_WORDS[marks[index]]}`)
    .join(', ');
  return `${word.toUpperCase()}: ${letters}.`;
}

/**
 * DW01-DW03, DW07, DW12, DW13: your board, what is wrong with the row or a
 * prompt under it, and the keyboard, which a finished board does without.
 */
export function PlayArea({
  rows,
  typed,
  problem,
  prompt,
  typing,
  keyboard,
  disabled,
  className,
}: {
  rows: readonly (WordBoardRow & { word: string })[];
  typed: string;
  /** Why the last Enter was turned back: "Not in the word list". */
  problem: string | null;
  /** A line under the board when nothing is wrong. */
  prompt?: ReactNode;
  typing: Typing;
  /** False once the board is done. */
  keyboard: boolean;
  /** A paused board: reconnecting, or a guess on its way. */
  disabled?: boolean;
  className?: string;
}) {
  const phone = useMediaQuery(PHONE);
  useTypingKeys(typing, keyboard && !disabled);
  const last = rows.at(-1);
  return (
    <div className={cx(styles.play, className)}>
      <WordBoard
        rows={rows}
        typed={typed.slice(0, WORD_LENGTH)}
        size={phone ? 'compact' : 'regular'}
        label="Your guesses"
      />
      {/* One line under the board, the same height whatever it says, so the
          keyboard never moves. */}
      <div className={styles.line}>
        {problem ? (
          <Notice tone="error">{problem}</Notice>
        ) : (
          prompt && <p className={styles.prompt}>{prompt}</p>
        )}
      </div>
      {keyboard && (
        <Keyboard
          marks={Object.fromEntries(keyMarks(rows))}
          disabled={disabled}
          {...typing}
        />
      )}
      <p className={styles.announce} aria-live="polite">
        {last ? describeRow(last.word, last.marks) : ''}
      </p>
    </div>
  );
}
