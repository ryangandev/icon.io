import { cx } from '../cx';
import styles from './avatar.module.css';

export const AVATAR_TONES = ['peach', 'blue', 'lime', 'sand', 'coral'] as const;
export type AvatarTone = (typeof AVATAR_TONES)[number];

export interface AvatarProps {
  initials: string;
  /** A player keeps one tone everywhere they appear. */
  tone: AvatarTone;
  /** Small (32 px) is the phone header's. */
  size?: 'regular' | 'small';
  /** Accessible name; without it the avatar is decorative. */
  label?: string;
  className?: string;
}

/** Zumpo/Avatar: a player's initials on their colour. */
export function Avatar({
  initials,
  tone,
  size = 'regular',
  label,
  className,
}: AvatarProps) {
  return (
    <span
      className={cx(
        styles.avatar,
        styles[tone],
        size === 'small' && styles.small,
        className,
      )}
      {...(label
        ? { role: 'img', 'aria-label': label }
        : { 'aria-hidden': true })}
    >
      {initials}
    </span>
  );
}
