import '../styles/components/chat-window.css';
import { Input } from 'antd';
import { EnterOutlined } from '@ant-design/icons';
import { useEffect, useRef, useState } from 'react';
import { useSocket } from '../hooks/useSocket';

interface ChatWindowProps {
    userName: string | null;
    roomId: string | undefined;
    isDrawer: boolean;
    gameStart: boolean;
}

const ChatWindow = (props: ChatWindowProps) => {
    const { socket } = useSocket();
    const [messages, setMessages] = useState<string[]>([]);
    const [inputMessage, setInputMessage] = useState<string>('');
    const [alreadyReceivedPts, setAlreadyReceivedPts] =
        useState<boolean>(false);
    const messageContainerRef = useRef<HTMLDivElement>(null);
    const user = props.userName;
    const room = props.roomId;

    // Scroll to bottom smoothly of chat window when new message is sent
    useEffect(() => {
        if (messageContainerRef.current) {
            messageContainerRef.current.scrollTo({
                top: messageContainerRef.current.scrollHeight,
                behavior: 'smooth',
            });
        }

        socket.on('receiveMessage', (message) => {
            setMessages([...messages, message]);
        });

        return () => {
            socket.off('receiveMessage');
        };
    }, [socket, messages]);

    const handleInputMessageChange = (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        setInputMessage(event.target.value);
    };

    const handleOnMessageSend = () => {
        if (inputMessage === '') return;

        setInputMessage(inputMessage);

        setMessages([...messages, user + '(Me): ' + inputMessage]);

        //Chat
        socket.emit(
            'sendMessage',
            inputMessage,
            user,
            room,
            alreadyReceivedPts,
        );
        setInputMessage('');
    };
    socket.on('ptsReceived', (data) => {
        setAlreadyReceivedPts(data);
    });

    return (
        <div className="chat-window-container">
            <div
                ref={messageContainerRef}
                className="chat-window-message-container"
            >
                {/* // Next line is a Spacer to push messages to bottom of chat window */}
                <div className="spacer" />
                <div className="message-wrapper">
                    {messages.map((message, index) => (
                        <div key={index} className="message">
                            {message}
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
                suffix={<EnterOutlined onClick={handleOnMessageSend} />}
            />
        </div>
    );
};

export default ChatWindow;
