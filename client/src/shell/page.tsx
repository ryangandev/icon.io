import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button, Header, type HeaderMenu, type Viewer } from '../ui';
import { useSession } from '../net/session';
import { initialsOf, toneOf } from '../players/avatar';
import { namePath } from './require-name';
import styles from './page.module.css';

// Games is the home page, and stays current on every game's own pages.
const LINKS = [
  { label: 'Games', to: '/', section: '/games' },
  { label: 'How to play', to: '/how-to-play', section: '/how-to-play' },
] as const;

/**
 * Every screen's frame: the header, the page's own content, and the footer.
 * A seated room brings its own room bar in place of the header.
 */
export function Page({
  header,
  children,
}: {
  header?: ReactNode;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const { viewer, viewerMenu } = useViewer();

  const links = LINKS.map(({ label, to, section }) => ({
    label,
    to,
    current:
      pathname === to ||
      pathname === section ||
      pathname.startsWith(`${section}/`),
  }));

  return (
    <div className={styles.page}>
      {header ?? (
        <Header links={links} viewer={viewer} viewerMenu={viewerMenu} />
      )}
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <span className={styles.wide}>Good company. One more round.</span>
        <span className={styles.wide}>zumpo. / play a little</span>
        <span className={styles.narrow}>A little play. Good company.</span>
      </footer>
    </div>
  );
}

/**
 * The viewer's avatar, once they have a name, and the session menu it opens:
 * who they are and the way to change it.
 */
export function useViewer(): { viewer?: Viewer; viewerMenu: HeaderMenu } {
  const navigate = useNavigate();
  const { name } = useSession();
  return {
    viewer: name
      ? {
          initials: initialsOf(name),
          tone: toneOf(name),
          label: `${name}: your name`,
        }
      : undefined,
    viewerMenu: {
      title: name,
      description:
        'Your name is saved for this browser session. Changing it takes you back to the start.',
      action: (
        <Button
          variant="secondary"
          icon="edit"
          className={styles.menuAction}
          onClick={() => navigate(namePath('/games'))}
        >
          Change name
        </Button>
      ),
    },
  };
}
