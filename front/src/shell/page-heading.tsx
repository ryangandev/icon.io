import type { ReactNode } from 'react';
import { Tag } from '../ui';
import { cx } from '../ui/cx';
import styles from './page-heading.module.css';

export interface PageHeadingProps {
  /** The sand tag above the title, in capitals. */
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** The home page's large two-line title. */
  hero?: boolean;
}

/** A page's sand eyebrow tag, title and muted subtitle. */
export function PageHeading({
  eyebrow,
  title,
  subtitle,
  hero,
}: PageHeadingProps) {
  return (
    <div className={styles.heading}>
      <Tag className={styles.eyebrow}>{eyebrow}</Tag>
      <h1 className={cx(styles.title, hero && styles.hero)}>{title}</h1>
      {subtitle != null && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
  );
}
