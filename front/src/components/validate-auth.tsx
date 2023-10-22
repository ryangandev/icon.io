// import { useEffect } from 'react';
// import toast from 'react-hot-toast';
// import { Navigate, Outlet, useNavigate } from 'react-router-dom';

// const ValidateAuth = () => {
//     const username = sessionStorage.getItem('username');
//     const navigate = useNavigate();

//     useEffect(() => {
//         if (!username) {
//             setTimeout(() => {
//                 toast.error('You have to enter a username before playing!');
//             }, 50);
//         }
//     }, [navigate, username]);

//     return username ? <Outlet /> : <Navigate to="/Landing" replace />;
// };

// export default ValidateAuth;

import { useState, useEffect, useRef } from 'react';
import { Modal, Input, InputRef } from 'antd';
import { Outlet, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const ValidateAuth = () => {
    const [username, setUsername] = useState<string | null>(
        sessionStorage.getItem('username'),
    );
    const [inputStatus, setInputStatus] = useState<'' | 'error' | undefined>();
    const [open, setOpen] = useState(!username);
    const navigate = useNavigate();
    const inputRef = useRef<InputRef>(null);

    const handleOk = () => {
        if (username && username.trim() !== '') {
            sessionStorage.setItem('username', username);
            setOpen(false);
            window.location.reload(); // Reload page to detect username change in session storage
        } else {
            toast.error('Username cannot be empty!');
            setInputStatus('error');
            setUsername('');
        }
    };

    const handleCancel = () => {
        setOpen(false);
        toast.error('You have to enter a username before playing!');
        navigate('/Landing', { replace: true });
    };

    useEffect(() => {
        console.log('username is: ', username);
        if (!username) {
            setOpen(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run on first render

    // Fix autoFocus not working on antd Input component within Modal
    // https://stackoverflow.com/questions/63408937/react-autofocus-on-input-field-inside-modal
    useEffect(() => {
        if (inputRef && inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    return (
        <>
            <Modal
                open={open}
                title="Enter Username"
                okText="Submit"
                cancelText="Cancel"
                onOk={handleOk}
                onCancel={handleCancel}
                width={400}
            >
                <Input
                    ref={inputRef}
                    name="username"
                    placeholder="Enter your username"
                    value={username || ''}
                    onChange={(e) => {
                        setUsername(e.target.value);
                        setInputStatus(undefined);
                    }}
                    showCount
                    maxLength={18}
                    required
                    status={inputStatus}
                    autoFocus
                    onPressEnter={handleOk}
                    style={{
                        marginTop: 10,
                        marginBottom: 10,
                    }}
                />
            </Modal>
            <Outlet />
        </>
    );
};

export default ValidateAuth;
