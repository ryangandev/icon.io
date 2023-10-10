import { Modal, Input } from 'antd';
import { useState } from 'react';

interface PasswordPromptModalProps {
    open: boolean;
    onCancel: () => void;
    onPasswordSubmit: (password: string) => void;
}

const PasswordPromptModal = ({
    open,
    onCancel,
    onPasswordSubmit,
}: PasswordPromptModalProps) => {
    const [passwordEntered, setPasswordEntered] = useState('');

    const handleSubmit = () => {
        onPasswordSubmit(passwordEntered);
        setPasswordEntered('');
    };

    return (
        <Modal
            open={open}
            title="Enter Room Password"
            okText="Join"
            cancelText="Cancel"
            onCancel={() => {
                setPasswordEntered('');
                onCancel();
            }}
            onOk={handleSubmit}
            width={350}
        >
            <Input.Password
                placeholder="Password"
                value={passwordEntered}
                onChange={(e) => setPasswordEntered(e.target.value)}
                showCount
                maxLength={20}
                required
                onPressEnter={handleSubmit}
                style={{
                    marginTop: 10,
                    marginBottom: 10,
                }}
            />
        </Modal>
    );
};

export default PasswordPromptModal;
