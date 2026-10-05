import type { ReactNode } from 'react';
import { cx } from '../cx';
import { Icon, type GlyphName } from './icon';
import styles from './notice.module.css';

export type NoticeTone = 'info' | 'success' | 'error' | 'pending';

const GLYPHS: Record<NoticeTone, GlyphName> = {
  info: 'info',
  success: 'check',
  error: 'alert',
  pending: 'pending',
};

export interface NoticeProps {
  tone?: NoticeTone;
  children: ReactNode;
  className?: string;
}

/**
 * Zumpo/Notice: page-level status for what the screen shows nowhere else.
 * Never repeat a field's own error in one.
 */
export function Notice({ tone = 'info', children, className }: NoticeProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(styles.notice, tone !== 'info' && styles[tone], className)}
    >
      {/* The 20 px icon is exactly one Label line tall, so it sits on the first line. */}
      <Icon glyph={GLYPHS[tone]} size={20} className={styles.icon} />
      <span className={styles.message}>{children}</span>
    </div>
  );
}
