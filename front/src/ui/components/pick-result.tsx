import { cx } from '../cx';
import { Avatar, type AvatarTone } from './avatar';
import type { PickOutcome } from './pick-marker';
import { Tag, type TagProps } from './tag';
import styles from './pick-result.module.css';

const OUTCOMES: Record<
  PickOutcome,
  Pick<TagProps, 'tone' | 'icon'> & { label: string }
> = {
  safe: { tone: 'lime', icon: 'check', label: 'Safe' },
  mine: { tone: 'peach', icon: 'mine', label: 'Mine' },
  auto: { tone: 'sand', icon: 'clock', label: 'Auto-picked' },
};

export interface PickResultProps {
  name: string;
  initials: string;
  tone: AvatarTone;
  outcome: PickOutcome;
  /** The outcome tag's own words, such as "Solved" for a safe outcome. */
  label?: string;
  /**
   * The risk the solver gave the cell before the round, plus "split 2 ways"
   * for a shared cell, joined with " · ". On a narrow row the parts wrap onto
   * lines of their own, never inside one.
   */
  detail: string;
  /** What the pick paid, signed. */
  points: number;
}

/**
 * Zumpo/Pick result: one player's pick in the round summary under the board.
 * It never names the cell; the board's markers show where. Make 24 lists a
 * hand's solves with it too.
 */
export function PickResult({
  name,
  initials,
  tone,
  outcome,
  label,
  detail,
  points,
}: PickResultProps) {
  const { label: outcomeLabel, ...tag } = OUTCOMES[outcome];
  return (
    <li className={cx(styles.row, outcome === 'mine' && styles.mine)}>
      <Avatar initials={initials} tone={tone} />
      <span className={styles.name}>{name}</span>
      <Tag {...tag}>{label ?? outcomeLabel}</Tag>
      <span className={styles.detail}>
        {detail.split(' · ').map((part, index) => (
          <span key={index}>
            {index > 0 && ' · '}
            <span className={styles.part}>{part}</span>
          </span>
        ))}
      </span>
      <span className={styles.points}>
        {points > 0 ? `+${points}` : points < 0 ? `−${-points}` : '0'}
      </span>
    </li>
  );
}
