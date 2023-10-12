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
            getContainer={document.getElementById('app')!} // Manually telling the modal dialog to render within root DOM https://github.com/ant-design/ant-design/issues/8668#issuecomment-1706599509
            destroyOnClose={true} // Destroy modal on close ensure that autoFocus eveytime the modal is opened
        >
            <Input.Password
                name="password"
                placeholder="Password"
                value={passwordEntered}
                onChange={(e) => setPasswordEntered(e.target.value)}
                showCount
                maxLength={20}
                required
                autoFocus
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
