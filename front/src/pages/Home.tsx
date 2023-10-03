import { FC, useEffect } from 'react';
import { Button, Space } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import draw from '../assets/draw-and-guess-bg.png';
import minesweeper from '../assets/minesweeper-bg.png';
import GameSelect from '../components/GameSelect';
import '../styles/pages/Home.css';
import toast from 'react-hot-toast';
import { useSocket } from '../hooks/useSocket';

const HomePage: FC = () => {
    const username = sessionStorage.getItem('username');
    const navigate = useNavigate();
    const { socket } = useSocket();

    useEffect(() => {
        if (!username) {
            setTimeout(() => {
                navigate('/Landing');
                toast.error('You have to enter a username before playing!');
            }, 100);
        } else {
            if (socket.connected) {
                console.log('socket is currently connected');
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
                        SELECT A GAME TO PLAY
                    </h2>
                    <Space
                        className="home-games-section-layout"
                        size={50}
                        wrap={true}
                        align="center"
                    >
                        <div>
                            <Link to="/Lobby">
                                <GameSelect
                                    gameTitle="Draw & Guess"
                                    color="#FFDFBF"
                                    img={draw}
                                />
                            </Link>
                        </div>
                        <div>
                            <Link to="/Lobby">
                                <GameSelect
                                    gameTitle="Minesweeper"
                                    color="#A7A6BA"
                                    img={minesweeper}
                                    isAvailable={false}
                                />
                            </Link>
                        </div>
                    </Space>
                </div>
            )}
        </>
    );
};

export default HomePage;
