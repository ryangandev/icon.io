import { type FC, useEffect } from 'react';
import { Button, Space, Typography } from 'antd';
import { Link, useNavigate } from 'react-router';
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
    if (!username) return;

    if (!socket.connected) {
      socket.connect();
      socket.on('connect', () => {
        toast.success(`Welcome, ${username}!`);
      });
    }

    socket.on('connect_error', (error) => {
      console.error('Could not reach the server:', error);
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
    socket.disconnect();
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

          <Typography.Title level={3} className="gamehub-game-select-text">
            Select a game to play!
          </Typography.Title>
          <Space
            className="gamehub-games-section-layout"
            size={50}
            wrap={true}
            align="center"
          >
            {GameData.map((game) => {
              const tile = (
                <GameSelect
                  key={game.title}
                  gameTitle={game.title}
                  color={game.thumbnailBgColor}
                  img={game.thumbnailImg}
                  isAvailable={game.isAvailable}
                />
              );

              // A game with nowhere to go is not a link. Minesweeper's tile
              // used to be wrapped in one pointing at a route that does not
              // exist: the click was swallowed by the tile itself, but a
              // middle-click, a ⌘-click or the keyboard all went to the 404.
              if (!game.isAvailable) return tile;

              return (
                <Link key={game.title} to={game.navigateTo}>
                  {tile}
                </Link>
              );
            })}
          </Space>
        </div>
      )}
    </>
  );
};

export default GamehubPage;
