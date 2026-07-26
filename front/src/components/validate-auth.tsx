import { useRef, useState } from 'react';
import { Modal, Input, type InputRef } from 'antd';
import { Outlet, useNavigate } from 'react-router';
import toast from 'react-hot-toast';

const USERNAME_MAX = 18; // matches the server's validation

/**
 * The gate every page below `/Gamehub` sits behind: you need a name to play.
 *
 * It used to render the page underneath immediately and then call
 * `window.location.reload()` once a name was entered, to make everything that
 * reads `sessionStorage` notice — which threw away the whole SPA, taking the
 * open socket and the identity handshake with it, and left a deep link into a
 * room half-joined under a name the server had rejected as empty.
 *
 * A gate that actually gates needs none of that. Nothing below mounts until
 * there is a name to mount it with, so nothing has to be told the name arrived.
 */
const ValidateAuth = () => {
  const [username, setUsername] = useState<string | null>(() =>
    sessionStorage.getItem('username'),
  );
  const [draft, setDraft] = useState(username ?? '');
  const [inputStatus, setInputStatus] = useState<'' | 'error' | undefined>();
  const navigate = useNavigate();
  const inputRef = useRef<InputRef>(null);

  const handleOk = () => {
    const chosen = draft.trim();

    if (chosen === '') {
      toast.error('Username cannot be empty!');
      setInputStatus('error');
      setDraft('');
      return;
    }

    sessionStorage.setItem('username', chosen);
    setUsername(chosen);
  };

  const handleCancel = () => {
    toast.error('You have to enter a username before playing!');
    navigate('/Landing', { replace: true });
  };

  return (
    <>
      <Modal
        open={!username}
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
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setInputStatus(undefined);
          }}
          showCount
          maxLength={USERNAME_MAX}
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
      {username && <Outlet />}
    </>
  );
};

export default ValidateAuth;
