import { cx } from '../cx';
import { Avatar, type AvatarTone } from './avatar';
import { Icon, type GlyphName } from './icon';
import { Tag } from './tag';
import styles from './player-row.module.css';

export type PlayerRowState = 'default' | 'highlight' | 'scored' | 'away';

export interface PlayerRowProps {
  name: string;
  initials: string;
  tone: AvatarTone;
  /** What the player is doing right now; never a generic "Connected". */
  status: string;
  statusIcon?: GlyphName;
  score: number;
  /** Shows the crown; it passes on when the host leaves. */
  host?: boolean;
  /** Marks the viewer. */
  you?: boolean;
  /**
   * Highlight: the player whose turn it is. Scored: guessed this turn.
   * Away: dropped, inside the reconnect grace.
   */
  state?: PlayerRowState;
  /** A list item by default; a div where the row is not one, as in standings. */
  as?: 'li' | 'div';
  className?: string;
}

/** Zumpo/Player row: one player in a room's list, which is sorted by score. */
export function PlayerRow({
  name,
  initials,
  tone,
  status,
  statusIcon,
  score,
  host = false,
  you = false,
  state = 'default',
  as: Row = 'li',
  className,
}: PlayerRowProps) {
  return (
    <Row
      className={cx(
        styles.row,
        state !== 'default' && styles[state],
        className,
      )}
    >
      <Avatar initials={initials} tone={tone} className={styles.avatar} />
      <span className={styles.details}>
        <span className={styles.nameLine}>
          <span className={styles.name}>{name}</span>
          {host && (
            <Icon
              glyph="crown"
              size={16}
              label="Host"
              className={styles.host}
            />
          )}
          {you && (
            <Tag size="compact" tone={state === 'highlight' ? 'paper' : 'sand'}>
              You
            </Tag>
          )}
        </span>
        <span className={styles.statusLine}>
          {statusIcon && (
            <Icon glyph={statusIcon} size={14} className={styles.statusIcon} />
          )}
          <span className={styles.status}>{status}</span>
        </span>
      </span>
      <span className={styles.score}>{score < 0 ? `−${-score}` : score}</span>
    </Row>
  );
}
