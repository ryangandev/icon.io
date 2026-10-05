import type { ReactNode } from 'react';
import { cx } from '../cx';
import { Icon, type GlyphName } from './icon';
import styles from './chat-message.module.css';

export type ChatMessageKind = 'player' | 'system' | 'success' | 'alert';

const GLYPHS: Record<Exclude<ChatMessageKind, 'player'>, GlyphName> = {
  system: 'info',
  success: 'check',
  alert: 'mine',
};

export interface ChatMessageProps {
  /**
   * Player: what someone typed (a wrong guess is just this). System: joins,
   * leaves, the game starting. Success: a correct guess and what it paid.
   * Alert: a mine hit.
   */
  kind: ChatMessageKind;
  /** The player's name, for kind player; "(you)" marks the viewer's own lines. */
  name?: string;
  children: ReactNode;
}

/** Zumpo/Chat message: one line in the room chat. */
export function ChatMessage({ kind, name, children }: ChatMessageProps) {
  return (
    <li className={cx(styles.message, styles[kind])}>
      {kind === 'player' ? (
        <span className={styles.name}>{name}</span>
      ) : (
        <span className={styles.iconSlot}>
          <Icon glyph={GLYPHS[kind]} size={16} />
        </span>
      )}
      <span className={styles.text}>{children}</span>
    </li>
  );
}
