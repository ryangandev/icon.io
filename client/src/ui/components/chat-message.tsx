import type { ReactNode } from 'react';
import { cx } from '../cx';
import { Icon, type GlyphName } from './icon';
import styles from './chat-message.module.css';

export type ChatMessageKind = 'player' | 'system' | 'success' | 'alert';

const GLYPHS: Record<Exclude<ChatMessageKind, 'player'>, GlyphName> = {
  system: 'info',
  success: 'check',
  alert: 'alert',
};

export interface ChatMessageProps {
  /**
   * Player: what someone typed (a wrong guess is just this). System: joins,
   * leaves, the game starting. Success: a correct guess and what it paid.
   * Alert: something went wrong for somebody, like a departure or a mine.
   */
  kind: ChatMessageKind;
  /** The Alert icon, for a game with its own: the mine in Minesweeper. */
  alertIcon?: GlyphName;
  /** The player's name, for kind player; "(you)" marks the viewer's own lines. */
  name?: string;
  children: ReactNode;
}

/** Zumpo/Chat message: one line in the room chat. */
export function ChatMessage({
  kind,
  name,
  alertIcon = GLYPHS.alert,
  children,
}: ChatMessageProps) {
  return (
    <li className={cx(styles.message, styles[kind])}>
      {kind === 'player' ? (
        <span className={styles.name}>{name}</span>
      ) : (
        <span className={styles.iconSlot}>
          <Icon glyph={kind === 'alert' ? alertIcon : GLYPHS[kind]} size={16} />
        </span>
      )}
      <span className={styles.text}>{children}</span>
    </li>
  );
}
