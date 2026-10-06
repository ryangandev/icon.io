import { Chat, ChatMessage, type ChatProps, type GlyphName } from '../ui';
import { useMessages } from '../i18n';
import { useRoomContext } from './room-context';

/**
 * The room's chat: what players typed, as they typed it, and what the server
 * announced, worded in the viewer's language.
 */
export function RoomChat({
  input,
  alertIcon,
}: {
  input: ChatProps['input'];
  /** The game's own Alert icon in the chat, as Chat message allows. */
  alertIcon?: GlyphName;
}) {
  const room = useRoomContext();
  const m = useMessages();
  return (
    <Chat input={input}>
      {room.chat.map((message) => (
        <ChatMessage
          key={message.id}
          kind={message.kind}
          alertIcon={alertIcon}
          name={
            message.playerId === room.playerId
              ? m.chat.you(message.username ?? '')
              : message.username
          }
        >
          {message.text}
        </ChatMessage>
      ))}
    </Chat>
  );
}
