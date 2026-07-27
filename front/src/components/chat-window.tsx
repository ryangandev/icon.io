import '../styles/components/chat-window.css';
import { Input } from 'antd';
import { EnterOutlined } from '@ant-design/icons';
import { useEffect, useRef, useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import { emit, off, on } from '../libs/socket-events';

interface ChatWindowProps {
  username: string | null;
  roomId: string;
  isDrawer: boolean;
  isDrawingPhase: boolean;
  receivedPointsThisTurn: boolean;
}

interface Message {
  username: string;
  message: string;
  color?: string;
}

const ChatWindow = ({
  username,
  roomId,
  isDrawer,
  isDrawingPhase,
  receivedPointsThisTurn,
}: ChatWindowProps) => {
  const { socket } = useSocket();
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');

  // Scroll to bottom smoothly of chat window when new message is sent
  useEffect(() => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTo({
        top: messageContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  useEffect(() => {
    on(socket, 'chat:message', (from: string, message: string) => {
      setMessages((prevMessages) => [
        ...prevMessages,
        { username: from, message },
      ]);
    });

    on(socket, 'dg:guess:correct', (from: string, message: string) => {
      setMessages((prevMessages) => [
        ...prevMessages,
        { username: from, message, color: '#d4f1d4' },
      ]);
    });

    return () => {
      off(socket, 'chat:message');
      off(socket, 'dg:guess:correct');
    };
  }, [socket]);

  const handleInputMessageChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setInputMessage(event.target.value);
  };

  const handleOnMessageSend = () => {
    if (inputMessage === '') return;
    if (!isDrawingPhase) {
      setMessages([
        ...messages,
        {
          username: username + '(You)',
          message: inputMessage,
          color: '#d4f1d4',
        },
      ]);

      emit(socket, 'chat:send', roomId, username, inputMessage);
    } else if (isDrawingPhase) {
      emit(socket, 'dg:guess', roomId, username, inputMessage);
    }

    setInputMessage('');
  };

  return (
    <div className="chat-window-container">
      <div ref={messageContainerRef} className="chat-window-message-container">
        {/* // Next line is a Spacer to push messages to bottom of chat window */}
        <div className="spacer" />
        <div className="message-wrapper">
          {messages.map((message, index) => (
            <div
              key={index}
              className="message"
              style={{
                backgroundColor: message.color,
              }}
            >
              {message.username}: {message.message}
            </div>
          ))}
        </div>
      </div>
      <Input
        size="large"
        placeholder="Type a message..."
        value={inputMessage}
        onChange={handleInputMessageChange}
        onPressEnter={handleOnMessageSend}
        maxLength={40}
        disabled={isDrawer || receivedPointsThisTurn}
        suffix={<EnterOutlined onClick={handleOnMessageSend} />}
      />
    </div>
  );
};

export default ChatWindow;
