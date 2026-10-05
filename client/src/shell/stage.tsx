import type { ReactNode } from 'react';
import styles from './stage.module.css';

/** Centres a page's one focused card, as Figma's "Dialog stage" does. */
export function Stage({ children }: { children: ReactNode }) {
  return <div className={styles.stage}>{children}</div>;
}
