import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { Navigate, Outlet } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';

const RequireSocket = () => {
    const { socket } = useSocket();

    useEffect(() => {
        if (!socket.connected) {
            setTimeout(() => {
                toast.error('Your connection to the server has been lost!');
            }, 50);
        }
    }, [socket.connected]);

    return socket.connected ? <Outlet /> : <Navigate to="/Gamehub" replace />;
};

export default RequireSocket;
