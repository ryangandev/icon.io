import { useState, FC } from 'react';
import { Button, Input, Space, Typography } from 'antd';
import { NavigateFunction, useNavigate } from 'react-router-dom';
import icon from '../assets/Game-Icon.png';
import '../styles/LandingPage.css';
import '../styles/CommonStyles.css';

const LandingPage: FC = () => {
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
            localStorage.setItem('username', name);
            navigate('/Home');
            console.log(name);
        }
    };

    return (
        <div className="defaultPageLayout">
            <Space id="landingPageHeader">
                <img id="landingPageIcon" src={icon} alt="logo" />
                <Typography id="landingPageText">icon.io</Typography>
            </Space>

            {/* TODO: Append number to duplicate usernames that may be added */}
            <Input
                size="large"
                placeholder="Enter your name"
                id="landingNameField"
                maxLength={18}
                onChange={handleOnchange}
                required={true}
                status={inputStatus}
            />

            <Button
                size="large"
                type="primary"
                id="landingButton"
                onClick={handleOnClick}
            >
                PLAY!
            </Button>
        </div>
    );
};

export default LandingPage;
