import { useMessages } from '../../i18n';
import { cx } from '../cx';
import styles from './hush-card.module.css';

/**
 * Hand: in your hand. Next: your lowest, the one you can play. Pile: the top
 * of the pile. Played: under it. Discarded: lost to a mistake, or to a player
 * who left.
 */
export type HushCardState = 'hand' | 'next' | 'pile' | 'played' | 'discarded';

export interface HushCardProps {
  /** 1 to 100. */
  value: number;
  state?: HushCardState;
  /**
   * Large is the top of the pile, Regular a hand, Small the rows of played
   * and discarded cards.
   */
  size?: 'large' | 'regular' | 'small';
  className?: string;
}

/** Zumpo/Hush card: one numbered card of Hush. */
export function HushCard({
  value,
  state = 'hand',
  size = 'regular',
  className,
}: HushCardProps) {
  const m = useMessages();
  return (
    <span
      className={cx(styles.card, styles[size], styles[state], className)}
      role="img"
      aria-label={state === 'discarded' ? m.ui.discarded(value) : String(value)}
    >
      {value}
    </span>
  );
}
