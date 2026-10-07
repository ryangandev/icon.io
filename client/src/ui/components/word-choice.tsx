import { useMessages } from '../../i18n';
import { cx } from '../cx';
import styles from './word-choice.module.css';

export interface WordChoiceProps {
  word: string;
  onChoose: () => void;
  className?: string;
}

/** Zumpo/Word choice: one of the drawer's three candidates, never shown to anyone else. */
export function WordChoice({ word, onChoose, className }: WordChoiceProps) {
  const m = useMessages();
  const letters = word.replaceAll(' ', '').length;
  return (
    <button
      type="button"
      className={cx(styles.choice, className)}
      onClick={onChoose}
    >
      <span className={styles.word}>{word}</span>
      <span className={styles.detail}>{m.ui.word.letters(letters)}</span>
    </button>
  );
}
