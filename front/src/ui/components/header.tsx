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

/** The person at the screen, shown by their avatar. */
export type Viewer = Pick<AvatarProps, 'initials' | 'tone' | 'label'>;

export interface HeaderProps {
  links: readonly HeaderLink[];
  /** The viewer, once they have a name. */
  viewer?: Viewer;
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
        {viewer && <ViewerAvatar viewer={viewer} menu={viewerMenu} />}
      </nav>
    </header>
  );
}

/**
 * The viewer's avatar at the end of a header or room bar: 40 px, 32 px on a
 * phone. With a menu it is the button that opens the session menu (P13).
 */
export function ViewerAvatar({
  viewer,
  menu,
}: {
  viewer: Viewer;
  menu?: HeaderMenu;
}) {
  if (!menu) return <Avatar {...viewer} className={styles.viewer} />;
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
