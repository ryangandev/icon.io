import { useState, FC } from 'react';
import { Button, Input, Typography } from 'antd';
import { NavigateFunction, useNavigate } from 'react-router-dom';
import icon from '../assets/Game-Icon.png';
import '../styles/pages/Landing.css';

const Landing: FC = () => {
    const [name, setName] = useState<string>('');
    const [inputStatus, setInputStatus] = useState<'' | 'error' | undefined>();
    const navigate: NavigateFunction = useNavigate();

    const handleOnchange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setName(e.target.value);
        setInputStatus(undefined);
    };

    const handleOnClick = () => {
        if (name.trim() === '') {
            setInputStatus('error');
            return;
        } else {
            sessionStorage.setItem('username', name);
            navigate('/Home');
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
                placeholder="Enter your name"
                className="landing-name-input"
                maxLength={18}
                onChange={handleOnchange}
                required={true}
                status={inputStatus}
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
