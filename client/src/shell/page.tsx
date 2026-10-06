import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import { Header, type Viewer, type ViewerMenu } from '../ui';
import { useSession } from '../net/session';
import { initialsOf, toneOf } from '../players/avatar';
import { useViewerMenu } from './name-menu';
import styles from './page.module.css';

const LINKS = [
  { label: 'Games', to: '/games' },
  { label: 'How to play', to: '/how-to-play' },
] as const;

/**
 * Every screen's frame: the header, the page's own content, and the footer.
 * A seated room brings its own room bar in place of the header.
 */
export function Page({
  header,
  nameHint = false,
  children,
}: {
  header?: ReactNode;
  /**
   * Where a first visit lands: the name menu opens by itself once to say
   * which name was picked (P02).
   */
  nameHint?: boolean;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const { viewer, viewerMenu } = useViewer({ hint: nameHint });

  const links = LINKS.map((link) => ({
    ...link,
    current: pathname === link.to || pathname.startsWith(`${link.to}/`),
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

/** The viewer's avatar and the name menu it opens. */
export function useViewer({ hint = false } = {}): {
  viewer: Viewer;
  viewerMenu: ViewerMenu;
} {
  const { name } = useSession();
  const viewerMenu = useViewerMenu({ hint });
  return {
    viewer: {
      initials: initialsOf(name),
      tone: toneOf(name),
      label: `${name}: your name`,
    },
    viewerMenu,
  };
}
