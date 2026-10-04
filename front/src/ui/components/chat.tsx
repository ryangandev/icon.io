import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { cx } from '../cx';
import { ChatInput, type ChatInputProps } from './chat-input';
import panel from './panel.module.css';
import styles from './chat.module.css';

export interface ChatProps {
  /** Zumpo/Chat messages, oldest first. */
  children: ReactNode;
  /** Changes whenever a message arrives, to keep the newest in view. */
  messageCount: number;
  input: ChatInputProps;
  className?: string;
}

/** Zumpo/Chat: the room chat, newest last, with the input under it. */
export function Chat({ children, messageCount, input, className }: ChatProps) {
  const log = useRef<HTMLUListElement>(null);
  const headingId = useId();

  useLayoutEffect(() => {
    const element = log.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messageCount]);

  return (
    <section
      className={cx(panel.panel, styles.chat, className)}
      aria-labelledby={headingId}
    >
      <h2 id={headingId} className={panel.heading}>
        Chat
      </h2>
      <ul ref={log} className={styles.log} role="log" aria-live="polite">
        {children}
      </ul>
      <ChatInput {...input} />
    </section>
  );
}
