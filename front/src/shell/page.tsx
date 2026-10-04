import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button, Header } from '../ui';
import { useSession } from '../net/session';
import { initialsOf, toneOf } from '../players/avatar';
import styles from './page.module.css';

const LINKS = [
  { label: 'Games', to: '/games' },
  { label: 'How to play', to: '/how-to-play' },
] as const;

/**
 * Every screen's frame: the header, the page's own content, and the footer.
 * The viewer's avatar appears once they have a name, and opens the session
 * menu.
 */
export function Page({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { name } = useSession();

  const links = LINKS.map((link) => ({
    ...link,
    current: pathname === link.to || pathname.startsWith(`${link.to}/`),
  }));

  return (
    <div className={styles.page}>
      <Header
        links={links}
        viewer={
          name
            ? {
                initials: initialsOf(name),
                tone: toneOf(name),
                label: `${name}: your name`,
              }
            : undefined
        }
        viewerMenu={{
          title: name,
          description:
            'Your name is saved for this browser session. Changing it takes you back to the start.',
          action: (
            <Button
              variant="secondary"
              icon="edit"
              className={styles.menuAction}
              onClick={() => navigate('/')}
            >
              Change name
            </Button>
          ),
        }}
      />
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <span className={styles.wide}>Good company. One more round.</span>
        <span className={styles.wide}>zumpo. / play a little</span>
        <span className={styles.narrow}>A little play. Good company.</span>
      </footer>
    </div>
  );
}
