import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';

const ValidateAuth = () => {
    const username = sessionStorage.getItem('username');
    const navigate = useNavigate();

    useEffect(() => {
        if (!username) {
            setTimeout(() => {
                toast.error('You have to enter a username before playing!');
            }, 50);
        }
    }, [navigate, username]);

    return username ? <Outlet /> : <Navigate to="/Landing" replace />;
};

export default ValidateAuth;
