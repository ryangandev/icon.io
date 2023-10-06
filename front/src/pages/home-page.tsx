import { FC, useEffect } from 'react';
import { Button, Space } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import GameSelect from '../components/game-select-container';
import '../styles/pages/home-page.css';
import toast from 'react-hot-toast';
import { useSocket } from '../hooks/useSocket';
import { GameData } from '../data/game';

const HomePage: FC = () => {
    const username = sessionStorage.getItem('username');
    const navigate = useNavigate();
    const { socket } = useSocket();

    useEffect(() => {
        if (socket.connected) {
            console.log(
                'socket is currently connected; connected socket id is: ',
                socket.id,
            );
        } else {
            console.log('socket is not connected, trying to connect...');
            try {
                socket.connect();
                socket.on('connect', () => {
                    console.log('connected, socket id is: ', socket.id);
                });
            } catch (err) {
                console.log('error connecting socket: ', err);
            }
        }
        toast.success(`Welcome, ${username}!`);

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
        console.log('logging out, disconnecting socket...');
        socket.disconnect();
        console.log('socket disconnected is: ', socket.disconnected);
        navigate('/Landing');
        toast.success('Logged out successfully!');
    };

    return (
        <>
            {!username ? (
                <div>Redirecting...</div>
            ) : (
                <div className="home-layout">
                    <div className="home-header">
                        <span className="home-header-text">
                            {' '}
                            Welcome, {username}!
                        </span>
                        <Button
                            type="default"
                            ghost
                            danger
                            onClick={handleLogout}
                            className="home-header-logout-btn"
                        >
                            Log out
                        </Button>
                    </div>

                    <h2 className="home-game-select-text">
                        Select a game to play!
                    </h2>
                    <Space
                        className="home-games-section-layout"
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

export default HomePage;
