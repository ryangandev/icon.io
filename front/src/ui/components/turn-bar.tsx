import { cx } from '../cx';
import { Countdown, type CountdownProps } from './countdown';
import { Tag } from './tag';
import styles from './turn-bar.module.css';

export type TurnBarKind = 'word' | 'hint' | 'status';

export interface TurnBarProps {
  /** The game's category, always shown. */
  category: string;
  /** What to do: "Draw the word", "Guess the word". */
  label: string;
  /**
   * Word: the drawer sees the word. Hint: guessers see the server's hint
   * string as is. Status: anything else (choosing, the reveal).
   */
  kind: TurnBarKind;
  main: string;
  /** Beside the main line, such as the letter count. */
  meta?: string;
  countdown: CountdownProps;
  className?: string;
}

/**
 * Zumpo/Turn bar: sits above the canvas and carries the turn. It lays itself
 * out as the Phone variant when its container is narrow.
 */
export function TurnBar({
  category,
  label,
  kind,
  main,
  meta,
  countdown,
  className,
}: TurnBarProps) {
  return (
    <div className={cx(styles.container, className)}>
      <section className={styles.bar} aria-label="Turn">
        <Tag className={styles.tag}>{category}</Tag>
        <span className={styles.label}>{label}</span>
        <p className={styles.answer} aria-live="polite">
          <span className={cx(styles.main, styles[kind])}>{main}</span>
          {meta && <span className={styles.meta}>{meta}</span>}
        </p>
        <Countdown {...countdown} className={styles.clock} />
      </section>
    </div>
  );
}
