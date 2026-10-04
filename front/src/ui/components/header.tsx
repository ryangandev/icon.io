import { Popover } from '@base-ui/react/popover';
import type { ReactNode } from 'react';
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
  /** Opened from the viewer's avatar: who they are and what they can change. */
  viewerMenu?: HeaderMenu;
  className?: string;
}

export interface HeaderMenu {
  title: ReactNode;
  description: ReactNode;
  /** One full-width button; it should close the menu as it acts. */
  action: ReactNode;
}

/**
 * Zumpo/Header: the wordmark home link, the main links and the viewer. On a
 * phone it is the Mobile navigation row: wordmark and a smaller avatar only.
 */
export function Header({ links, viewer, viewerMenu, className }: HeaderProps) {
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
        {viewer &&
          (viewerMenu ? (
            <ViewerMenu viewer={viewer} menu={viewerMenu} />
          ) : (
            <Avatar {...viewer} className={styles.viewer} />
          ))}
      </nav>
    </header>
  );
}

function ViewerMenu({
  viewer,
  menu,
}: {
  viewer: NonNullable<HeaderProps['viewer']>;
  menu: HeaderMenu;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        className={styles.viewerButton}
        aria-label={viewer.label ?? 'Your name'}
      >
        <Avatar
          initials={viewer.initials}
          tone={viewer.tone}
          className={styles.viewer}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          className="zumpo"
          side="bottom"
          align="end"
          sideOffset={16}
          collisionPadding={16}
        >
          <Popover.Popup className={styles.menu}>
            <Popover.Title className={styles.menuTitle}>
              {menu.title}
            </Popover.Title>
            <Popover.Description className={styles.menuDescription}>
              {menu.description}
            </Popover.Description>
            {menu.action}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
