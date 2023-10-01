import { Outlet } from 'react-router-dom';
import AppLogo from './components/AppLogo';

const Layout = () => {
    return (
        <main className="AppLayout">
            <AppLogo />
            <Outlet />
        </main>
    );
};

export default Layout;
