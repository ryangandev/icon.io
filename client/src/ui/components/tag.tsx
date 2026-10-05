import type { ReactNode } from 'react';
import { cx } from '../cx';
import { Icon, type GlyphName } from './icon';
import styles from './tag.module.css';

export type TagTone = 'sand' | 'blue' | 'lime' | 'peach' | 'paper' | 'ink';

export interface TagProps {
  /**
   * Sand is neutral context, Blue a phase, Lime good or live, Peach blocked,
   * Ink the current tab or a strong marker.
   */
  tone?: TagTone;
  /** Compact sits inside a line of text, like the "You" marker. */
  size?: 'regular' | 'compact';
  icon?: GlyphName;
  children: ReactNode;
  className?: string;
}

/** Zumpo/Tag: a small label for context and state. */
export function Tag({
  tone = 'sand',
  size = 'regular',
  icon,
  children,
  className,
}: TagProps) {
  return (
    <span
      className={cx(
        styles.tag,
        tone !== 'sand' && styles[tone],
        size === 'compact' && styles.compact,
        className,
      )}
    >
      {icon && <Icon glyph={icon} size={14} />}
      {children}
    </span>
  );
}
