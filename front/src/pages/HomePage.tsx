import { FC } from 'react';
import { Button, Space } from 'antd';
import { Link } from 'react-router-dom';
import draw from '../assets/draw-and-guess-bg.png';
import minesweeper from '../assets/minesweeper-bg.png';
import GameSelect from '../components//GameSelect';
import '../styles/HomePage.css'

const HomePage: FC = () => {
    const username = localStorage.getItem('username');

    return (
        <div className='defaultPageLayout'>
            <Space style={{ marginBottom: 30 }}>
                <h1 className='userGreeting'> Welcome, { username }!</h1>
                <Link to="/Landing">
                    <Button 
                        type="text"
                        className='logoutButton' >
                        <div style={{ borderBottom: '3px solid blue' }}>Log out</div>
                    </Button>
                </Link>
            </Space>

            <h2 style={{ textAlign: "center"}}>SELECT A GAME TO PLAY</h2>
            <Space style={{ margin: 30 }}>
                <div style={{ userSelect: 'none', margin: "15px 40px" }}>
                    <Link to="/Lobby">
                        <GameSelect color="#FFDFBF" img={ draw } />
                    </Link>
                </div>
                <div style={{ margin: "15px 40px", pointerEvents: 'none', userSelect: 'none', opacity: 0.2 }}>
                    <Link to="/Lobby">
                        <GameSelect color="#A7A6BA" img={ minesweeper } />
                    </Link>
                </div>
            </Space>
        </div>
    )
}

export default HomePage;