import type { ReactNode } from 'react';
import { Icon } from '../ui';
import styles from './status-line.module.css';

/**
 * A request in flight, said in words: "Connecting…", "Creating your room…".
 * It stands in for the button that started it, which is never disabled.
 */
export function StatusLine({ children }: { children: ReactNode }) {
  return (
    <p className={styles.status} role="status">
      <Icon glyph="pending" size={20} className={styles.icon} />
      {children}
    </p>
  );
}
