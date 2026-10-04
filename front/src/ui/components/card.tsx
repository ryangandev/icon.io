import type { FormEventHandler, ReactNode } from 'react';
import { useId } from 'react';
import { cx } from '../cx';
import styles from './card.module.css';

export interface CardProps {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons, primary first. */
  actions?: ReactNode;
  /** Makes the card a form, so Enter submits it. */
  onSubmit?: FormEventHandler<HTMLFormElement>;
  className?: string;
}

/** The focused card of a one-question page: a name, a new room, a password. */
export function Card({
  title,
  description,
  children,
  actions,
  onSubmit,
  className,
}: CardProps) {
  const titleId = useId();
  const content = (
    <>
      <h1 id={titleId} className={styles.title}>
        {title}
      </h1>
      {description != null && (
        <p className={styles.description}>{description}</p>
      )}
      {children}
      {actions != null && <div className={styles.actions}>{actions}</div>}
    </>
  );
  return onSubmit ? (
    <form
      className={cx(styles.card, className)}
      aria-labelledby={titleId}
      onSubmit={onSubmit}
    >
      {content}
    </form>
  ) : (
    <section className={cx(styles.card, className)} aria-labelledby={titleId}>
      {content}
    </section>
  );
}
