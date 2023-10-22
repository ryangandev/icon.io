import { useState, FC, useEffect } from 'react';
import { Button, Input, Typography } from 'antd';
import { NavigateFunction, useNavigate } from 'react-router-dom';
import icon from '../assets/Game-Icon.png';
import '../styles/pages/landing-page.css';
import toast from 'react-hot-toast';

const Landing: FC = () => {
    const [username, setUsername] = useState<string>(
        sessionStorage.getItem('username') || '',
    );
    const [inputStatus, setInputStatus] = useState<'' | 'error' | undefined>();
    const navigate: NavigateFunction = useNavigate();

    useEffect(() => {
        if (username.trim() !== '') {
            navigate('/Gamehub');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate]);

    const handleOnchange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUsername(e.target.value);
        setInputStatus(undefined);
    };

    const handleOnClick = () => {
        if (username.trim() === '') {
            toast.error('Username cannot be empty!');
            setInputStatus('error');
            setUsername('');
        } else {
            sessionStorage.setItem('username', username);
            navigate('/Gamehub');
        }
    };

    return (
        <div className="landing-layout">
            <div className="landing-logo-container">
                <img className="landing-logo-img" src={icon} alt="logo" />
                <Typography className="landing-logo-text">con.io</Typography>
            </div>

            <Input
                size="large"
                value={username}
                placeholder="Enter your username"
                className="landing-name-input"
                maxLength={18}
                onChange={handleOnchange}
                required={true}
                status={inputStatus}
                onPressEnter={handleOnClick}
                autoFocus={true}
            />

            <Button
                type="primary"
                className="landing-submit-button"
                onClick={handleOnClick}
            >
                PLAY!
            </Button>
        </div>
    );
};

export default Landing;
