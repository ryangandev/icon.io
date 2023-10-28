import { FC, useEffect } from 'react';
import { Button, Space, Typography } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import GameSelect from '../components/game-select-container';
import '../styles/pages/gamehub-page.css';
import toast from 'react-hot-toast';
import { useSocket } from '../hooks/useSocket';
import { GameData } from '../data/game';

const GamehubPage: FC = () => {
    const username = sessionStorage.getItem('username');
    const navigate = useNavigate();
    const { socket } = useSocket();

    useEffect(() => {
        console.log('A user is entering, username is: ', username);
        if (!username) return;

        if (socket.connected) {
            console.log('Socket is currently connected');
        } else {
            console.log('Socket is not connected, trying to connect...');
            try {
                socket.connect();
                socket.on('connect', () => {
                    toast.success(`Welcome, ${username}!`);
                    console.log('Socket successfully connected!');
                });
            } catch (err) {
                console.log('Error connecting socket: ', err);
            }
        }

        socket.on('connect_error', (error) => {
            console.log('Connection Error:', error);
            sessionStorage.removeItem('username');
            socket.disconnect();
            navigate('/Landing');
            toast.error('Connection error. Please try again later.');
        });

        return () => {
            // Clean up listeners
            socket.off('connect');
            socket.off('connect_error');
        };
    }, [navigate, username, socket]);

    const handleLogout = () => {
        sessionStorage.removeItem('username');
        console.log('Logging out, disconnecting socket...');
        socket.disconnect();
        console.log('Socket disconnected is: ', socket.disconnected);
        navigate('/Landing');
        toast.success('Logged out successfully!');
    };

    return (
        <>
            {!username ? (
                <div style={{ marginTop: 40, fontSize: 30, fontWeight: 600 }}>
                    Redirecting...
                </div>
            ) : (
                <div className="gamehub-layout">
                    <Space size="large" className="gamehub-header">
                        <Typography.Text className="gamehub-header-text">
                            {' '}
                            Welcome, {username}!
                        </Typography.Text>
                        <Button
                            type="default"
                            ghost
                            danger
                            onClick={handleLogout}
                            className="gamehub-header-logout-btn"
                        >
                            Log out
                        </Button>
                    </Space>

                    <Typography.Title
                        level={3}
                        className="gamehub-game-select-text"
                    >
                        Select a game to play!
                    </Typography.Title>
                    <Space
                        className="gamehub-games-section-layout"
                        size={50}
                        wrap={true}
                        align="center"
                    >
                        {GameData.map((game, index) => (
                            <Link key={game.title} to={game.navigateTo}>
                                <GameSelect
                                    gameTitle={game.title}
                                    color={game.thumbnailBgColor}
                                    img={game.thumbnailImg}
                                    isAvailable={game.isAvailable}
                                />
                            </Link>
                        ))}
                    </Space>
                </div>
            )}
        </>
    );
};

export default GamehubPage;
