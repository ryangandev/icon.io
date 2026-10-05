import { cx } from '../cx';
import { WordBoard, type WordBoardRow } from './word-board';
import styles from './race-board.module.css';

export type RaceBoardState = 'guessing' | 'found' | 'out';

export interface RaceBoardProps {
  name: string;
  /** "3 guesses", "Found · +431", "Missed". */
  status: string;
  state?: RaceBoardState;
  /**
   * Mini during a round, marks only and never letters; Small at the reveal,
   * with the letters.
   */
  board?: 'mini' | 'small';
  rows: readonly WordBoardRow[];
}

/** Zumpo/Race board: one player's board beside their name. */
export function RaceBoard({
  name,
  status,
  state = 'guessing',
  board = 'mini',
  rows,
}: RaceBoardProps) {
  return (
    <div className={cx(styles.race, styles[board], styles[state])}>
      <div className={styles.head}>
        <span className={styles.name}>{name}</span>
        <span className={styles.status}>{status}</span>
      </div>
      <WordBoard rows={rows} size={board} label={`${name}’s board`} />
    </div>
  );
}
