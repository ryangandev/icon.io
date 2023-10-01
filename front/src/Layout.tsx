import { Outlet } from 'react-router-dom';
import AppLogo from './components/AppLogo';
import { Toaster } from 'react-hot-toast';

const Layout = () => {
    return (
        <main className="AppLayout">
            <AppLogo />
            <Outlet />
            <Toaster position="top-center" />
        </main>
    );
};

export default Layout;
