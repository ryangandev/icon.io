import { Link } from 'react-router';
import { useMessages } from '../../i18n';
import { cx } from '../cx';
import { Button } from './button';
import { ViewerAvatar, type Viewer, type ViewerMenu } from './header';
import { Tag, type TagTone } from './tag';
import { Wordmark } from './wordmark';
import styles from './room-bar.module.css';

export interface RoomBarProps {
  /**
   * Desktop is one row after the wordmark. Phone has no wordmark, puts the
   * tags under the game and keeps the actions to their icons.
   */
  layout?: 'desktop' | 'phone';
  game: string;
  /** The room's name, the first tag. */
  room: string;
  /** Where the room is: "Waiting room", "Round 2 of 2", "Game over". */
  phase: { tone: TagTone; label: string };
  onHowToPlay: () => void;
  /** Without it, as while reconnecting, there is no Leave room button. */
  onLeave?: () => void;
  /** "Leave room"; a game on your own has no room, so it says "Leave". */
  leaveLabel?: string;
  viewer?: Viewer;
  viewerMenu?: ViewerMenu;
  className?: string;
}

/**
 * Zumpo/Room bar: a seated room's header and heading in one row, and a game on your own's. How to play
 * opens over the room and Leave room is the way out; the wordmark is a way
 * out too, so whoever renders the bar guards the navigation.
 */
export function RoomBar({
  layout = 'desktop',
  game,
  room,
  phase,
  onHowToPlay,
  onLeave,
  leaveLabel = 'Leave room',
  viewer,
  viewerMenu,
  className,
}: RoomBarProps) {
  const m = useMessages();
  const phone = layout === 'phone';
  return (
    <header className={cx(styles.bar, phone && styles.phone, className)}>
      {!phone && (
        <>
          <Link to="/" className={styles.home} aria-label={m.shell.nav.home}>
            <Wordmark />
          </Link>
          <span className={styles.divider} aria-hidden="true" />
        </>
      )}
      <div className={styles.identity}>
        <h1 className={styles.game}>{game}</h1>
        <div className={styles.tags}>
          <Tag>{room}</Tag>
          <Tag tone={phase.tone}>{phase.label}</Tag>
        </div>
      </div>
      <Button
        variant="secondary"
        icon="info"
        iconOnly={phone}
        onClick={onHowToPlay}
      >
        How to play
      </Button>
      {onLeave && (
        <Button
          variant="secondary"
          icon="leave"
          iconOnly={phone}
          onClick={onLeave}
        >
          {leaveLabel}
        </Button>
      )}
      {viewer && <ViewerAvatar viewer={viewer} menu={viewerMenu} />}
    </header>
  );
}
