import { Space } from 'antd';
import { Outlet } from 'react-router-dom';
import icon from '../assets/Game-Icon.png';
import '../styles/Header.css';

function Header() {
    return (
        <>
            <Space size="large">
                <div className="logo-container">
                    <img
                        style={{
                            width: '30px',
                            height: '30px',
                            marginRight: '10px',
                        }}
                        src={icon}
                        alt="logo"
                    />
                    <p className="logo-title">icon.io</p>
                </div>
            </Space>
            <Outlet />
        </>
    );
}

export default Header;
