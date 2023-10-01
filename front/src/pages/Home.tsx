import { FC, useEffect } from 'react';
import { Button, Space } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import draw from '../assets/draw-and-guess-bg.png';
import minesweeper from '../assets/minesweeper-bg.png';
import GameSelect from '../components/GameSelect';
import '../styles/pages/Home.css';
import toast from 'react-hot-toast';

const HomePage: FC = () => {
    const username = sessionStorage.getItem('username');
    const navigate = useNavigate();

    useEffect(() => {
        if (!username) {
            setTimeout(() => {
                navigate('/Landing');
                toast.error('You have to enter a username before playing!');
            }, 50);
        } else {
            toast.success(`Welcome, ${username}!`);
        }
    }, [navigate, username]);

    const handleLogout = () => {
        sessionStorage.removeItem('username');
        navigate('/Landing');
        toast.success('Logged out successfully!');
    };

    return (
        <div className="home-layout">
            <div className="home-header">
                <span className="home-header-text"> Welcome, {username}!</span>
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

            <h2 className="home-game-select-text">SELECT A GAME TO PLAY</h2>
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
    );
};

export default HomePage;
