import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { cx } from '../cx';
import { ChatInput, type ChatInputProps } from './chat-input';
import panel from './panel.module.css';
import styles from './chat.module.css';

export interface ChatProps {
  /** Zumpo/Chat messages, oldest first. */
  children: ReactNode;
  input: ChatInputProps;
  className?: string;
}

/** Zumpo/Chat: the room chat, newest last, with the input under it. */
export function Chat({ children, input, className }: ChatProps) {
  const log = useRef<HTMLUListElement>(null);
  const headingId = useId();

  // The newest message stays in view: on opening, and as each one arrives.
  useLayoutEffect(() => {
    const element = log.current;
    if (!element) return;
    const showNewest = () => {
      element.scrollTop = element.scrollHeight;
    };
    showNewest();
    const observer = new MutationObserver(showNewest);
    observer.observe(element, { childList: true });
    return () => observer.disconnect();
  }, []);

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
