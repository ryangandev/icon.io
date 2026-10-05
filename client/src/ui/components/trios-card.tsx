import { cardFeatures, cardName } from '../../../../shared/trios';
import { cx } from '../cx';
import { TriosShape } from './trios-shape';
import styles from './trios-card.module.css';

export type TriosCardState =
  | 'default'
  /** Picked, on the picker's own screen only. */
  | 'selected'
  /** Part of a trio just taken. */
  | 'found'
  /** Part of three that were not a trio. */
  | 'wrong';

export type TriosCardSize = 'regular' | 'compact' | 'mini';

export interface TriosCardProps {
  /** The card, from 0 to 80 (shared/trios.ts). */
  card: number;
  state?: TriosCardState;
  /**
   * Regular is 192 × 128; Compact, 110 × 76, fits three columns on a phone;
   * Mini, 72 × 48, lists a trio in a line.
   */
  size?: TriosCardSize;
  /** The pill on its corner: "Hint", or a found trio's finder's initials. */
  badge?: string;
  /** What the badge means, for the card's accessible name: "hint". */
  badgeLabel?: string;
  /** Makes the card a button that picks it or puts it back. */
  onPick?: () => void;
  /** A card that cannot be picked now, while a claim is judged. */
  disabled?: boolean;
}

/** Each size's shapes, as Figma scales the 40 px shape in it. */
const SHAPE_SIZE = { regular: 40, compact: 24, mini: 16 } as const;

const STATE_NAMES: Readonly<Record<TriosCardState, string>> = {
  default: '',
  selected: ', picked',
  found: ', found',
  wrong: ', not a trio',
};

/** Zumpo/Trios card: one card of a Trios table, with one to three shapes. */
export function TriosCard({
  card,
  state = 'default',
  size = 'regular',
  badge,
  badgeLabel,
  onPick,
  disabled,
}: TriosCardProps) {
  const { colour, shape, count, fill } = cardFeatures(card);
  const label = `${cardName(card)}${STATE_NAMES[state]}${badgeLabel ? `, ${badgeLabel}` : ''}`;
  const className = cx(
    styles.card,
    size !== 'regular' && styles[size],
    state !== 'default' && styles[state],
  );
  const content = (
    <>
      {Array.from({ length: count }, (_, index) => (
        <TriosShape
          key={index}
          shape={shape}
          fill={fill}
          colour={colour}
          size={SHAPE_SIZE[size]}
        />
      ))}
      {badge && (
        <span className={styles.badge} aria-hidden="true">
          {badge}
        </span>
      )}
    </>
  );
  if (!onPick) {
    return (
      <span className={className} role="img" aria-label={label}>
        {content}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={cx(className, styles.button)}
      aria-label={label}
      aria-pressed={state === 'selected'}
      disabled={disabled}
      onClick={onPick}
    >
      {content}
    </button>
  );
}
