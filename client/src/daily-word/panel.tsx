import type { ReactNode } from 'react';
import { LetterTile } from '../ui';
import styles from './panel.module.css';

/** The paper panel a board is played on (DW01-DW10); bare on a phone. */
export function BoardPanel({ children }: { children: ReactNode }) {
  return <div className={styles.panel}>{children}</div>;
}

/** DW01-DW03: what the three marks mean, beside a board on your own. */
export function MarkLegend() {
  return (
    <ul className={styles.legend}>
      <li className={styles.mark}>
        <LetterTile letter="P" state="correct" size="small" />
        Right letter, right place
      </li>
      <li className={styles.mark}>
        <LetterTile letter="L" state="present" size="small" />
        In the word, somewhere else
      </li>
      <li className={styles.mark}>
        <LetterTile letter="S" state="absent" size="small" />
        Not in the word
      </li>
    </ul>
  );
}
