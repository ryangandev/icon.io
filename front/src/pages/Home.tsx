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
            <Space style={{ marginBottom: 30 }}>
                <h1 className="userGreeting"> Welcome, {username}!</h1>
                <Button
                    type="text"
                    onClick={handleLogout}
                    className="logoutButton"
                >
                    <div style={{ borderBottom: '3px solid blue' }}>
                        Log out
                    </div>
                </Button>
            </Space>

            <h2 style={{ textAlign: 'center' }}>SELECT A GAME TO PLAY</h2>
            <Space style={{ margin: 30 }}>
                <div style={{ userSelect: 'none', margin: '15px 40px' }}>
                    <Link to="/Lobby">
                        <GameSelect color="#FFDFBF" img={draw} />
                    </Link>
                </div>
                <div
                    style={{
                        margin: '15px 40px',
                        pointerEvents: 'none',
                        userSelect: 'none',
                        opacity: 0.2,
                    }}
                >
                    <Link to="/Lobby">
                        <GameSelect color="#A7A6BA" img={minesweeper} />
                    </Link>
                </div>
            </Space>
        </div>
    );
};

export default HomePage;
