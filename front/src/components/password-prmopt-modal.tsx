import { Modal, Input } from 'antd';
import { useState } from 'react';

interface PasswordPromptModalProps {
  open: boolean;
  roomName: string;
  onCancel: () => void;
  onPasswordSubmit: (password: string) => void;
}

const PasswordPromptModal = ({
  open,
  roomName,
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
      // Naming the room matters now that a single modal serves the whole
      // table rather than one being rendered per row.
      title={roomName ? `Password for "${roomName}"` : 'Enter Room Password'}
      okText="Join"
      cancelText="Cancel"
      onCancel={() => {
        setPasswordEntered('');
        onCancel();
      }}
      onOk={handleSubmit}
      width={350}
      getContainer={document.getElementById('app')!} // Manually telling the modal dialog to render within root DOM https://github.com/ant-design/ant-design/issues/8668#issuecomment-1706599509
      destroyOnHidden={true} // Destroy modal on close ensure that autoFocus eveytime the modal is opened
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
