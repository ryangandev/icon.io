import { useMessages } from '../../i18n';
import { useId } from 'react';
import { cx } from '../cx';
import { Button } from './button';
import { Die, type DieFace } from './die';
import { Fit } from '../../shell/fit';
import styles from './bid-picker.module.css';

/** The faces a bid may name; ones are wild and never bid. */
const FACES: readonly DieFace[] = [2, 3, 4, 5, 6];

export interface BidPickerProps {
  /** How many dice the bid says. */
  count: number;
  /** Which face, 2 to 6; shown Counted among the five. */
  face: DieFace;
  onCountChange: (count: number) => void;
  onFaceChange: (face: DieFace) => void;
  /** The faces any raise is left on; the rest are off, as when the table is bid out on them. */
  openFaces?: readonly DieFace[];
  /** Whether one fewer is still a raise; Fewer is off at the smallest count the face allows. */
  canFewer: boolean;
  /** Whether one more fits on the table. */
  canMore: boolean;
  /** "Bid five 6s". */
  bidLabel: string;
  onBid: () => void;
  /** Calls Liar on the bid in front of you; without it, as when nobody has bid yet, Call Liar is hidden. */
  onCall?: () => void;
  className?: string;
}

/**
 * Zumpo/Bid picker: your turn. How many dice, showing which face, then Bid
 * or Call Liar. It lays itself out as the Phone variant when its container is
 * narrow.
 */
export function BidPicker({
  count,
  face,
  onCountChange,
  onFaceChange,
  openFaces = FACES,
  canFewer,
  canMore,
  bidLabel,
  onBid,
  onCall,
  className,
}: BidPickerProps) {
  const m = useMessages();
  const id = useId();
  return (
    <div className={cx(styles.container, className)}>
      <div className={styles.picker} role="group" aria-label={m.ui.dice.picker}>
        <div className={styles.controls}>
          <div className={styles.field}>
            <span className={styles.label} id={`${id}-count`}>
              {m.ui.dice.howMany}
            </span>
            <div className={styles.stepper}>
              <Button
                variant="secondary"
                disabled={!canFewer}
                onClick={() => onCountChange(count - 1)}
                aria-label={m.ui.dice.fewer}
              >
                −
              </Button>
              <output
                className={styles.count}
                aria-labelledby={`${id}-count`}
                aria-live="polite"
              >
                {count}
              </output>
              <Button
                variant="secondary"
                disabled={!canMore}
                onClick={() => onCountChange(count + 1)}
                aria-label={m.ui.dice.more}
              >
                +
              </Button>
            </div>
          </div>
          <div className={styles.field}>
            <span className={styles.label} id={`${id}-face`}>
              {m.ui.dice.showing}
            </span>
            <Fit align="start">
              <div
                className={styles.faces}
                role="radiogroup"
                aria-labelledby={`${id}-face`}
              >
                {FACES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={option === face}
                    aria-label={m.ui.dice.face(option)}
                    className={styles.face}
                    disabled={!openFaces.includes(option)}
                    onClick={() => onFaceChange(option)}
                  >
                    <Die
                      face={option}
                      state={option === face ? 'counted' : 'default'}
                      label={null}
                    />
                  </button>
                ))}
              </div>
            </Fit>
          </div>
        </div>
        <div className={styles.actions}>
          <Button onClick={onBid}>{bidLabel}</Button>
          {onCall && (
            <Button variant="danger" onClick={onCall}>
              {m.ui.dice.call}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
