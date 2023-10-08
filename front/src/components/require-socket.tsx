import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Navigate, Outlet } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';

const RequireSocket = () => {
    const { socket } = useSocket();
    const [isConnected, setIsConnected] = useState(socket.connected);

    useEffect(() => {
        const handleConnect = () => setIsConnected(true);
        const handleDisconnect = () => {
            setIsConnected(false);
            toast.error('Your connection to the server has been lost!');
        };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);

        return () => {
            // Cleanup event listeners
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
        };
    }, [socket]);

    // If socket is not connected, redirect back to Gamehub page to try to initiate connection
    return isConnected ? <Outlet /> : <Navigate to="/Gamehub" replace />;
};

export default RequireSocket;
