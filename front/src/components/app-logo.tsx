import Typography from 'antd/es/typography/Typography';
import icon from '../assets/Game-Icon.png';
import '../styles/AppLogo.css';

const AppLogo = () => {
    return (
        <div className="logo-container">
            <img className="logo-img" src={icon} alt="logo" />
            <Typography className="logo-text">con.io</Typography>
        </div>
    );
};

export default AppLogo;
