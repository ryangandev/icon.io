import { Link } from 'react-router';
import { cx } from '../cx';
import { Avatar, type AvatarProps } from './avatar';
import { Wordmark } from './wordmark';
import styles from './header.module.css';

export interface HeaderLink {
  label: string;
  to: string;
  current?: boolean;
}

export interface HeaderProps {
  links: readonly HeaderLink[];
  /** The viewer, once they have a name. */
  viewer?: Pick<AvatarProps, 'initials' | 'tone' | 'label'>;
  className?: string;
}

/**
 * Zumpo/Header: the wordmark home link, the main links and the viewer. On a
 * phone it is the Mobile navigation row: wordmark and a smaller avatar only.
 */
export function Header({ links, viewer, className }: HeaderProps) {
  return (
    <header className={cx(styles.header, className)}>
      <Link to="/" className={styles.home} aria-label="Zumpo home">
        <Wordmark />
      </Link>
      <nav className={styles.nav} aria-label="Main">
        <ul className={styles.links}>
          {links.map((link) => (
            <li key={link.label}>
              <Link
                to={link.to}
                className={styles.link}
                aria-current={link.current ? 'page' : undefined}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        {viewer && <Avatar {...viewer} className={styles.viewer} />}
      </nav>
    </header>
  );
}
