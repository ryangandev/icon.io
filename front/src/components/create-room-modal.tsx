import { FC, useState } from 'react';
import { Button, Modal } from 'antd';
import { PlusCircleOutlined } from '@ant-design/icons';
import '../styles/pages/lobbies/draw-and-guess-lobby.css';

interface RoomCreateModalProps {
    handleOnCreateRoomBtnClick: () => void;
}

const RoomCreateModal: FC<RoomCreateModalProps> = (
    props: RoomCreateModalProps,
) => {
    const [open, setOpen] = useState(false);
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [modalText, setModalText] = useState('Click OK to create a new room');

    const showModal = () => {
        setOpen(true);
    };

    const handleOk = () => {
        setModalText('Creating a new room...');
        setConfirmLoading(true);

        setTimeout(() => {
            setOpen(false);
            setConfirmLoading(false);
            props.handleOnCreateRoomBtnClick();
        }, 1500);
    };

    const handleCancel = () => {
        console.log('Clicked cancel button');
        setOpen(false);
    };

    return (
        <>
            <Button
                type="primary"
                ghost
                className="action-button"
                onClick={showModal}
                icon={<PlusCircleOutlined />}
            >
                Create Room
            </Button>
            <Modal
                title="Create a new room"
                open={open}
                onOk={handleOk}
                confirmLoading={confirmLoading}
                onCancel={handleCancel}
            >
                <p>{modalText}</p>
            </Modal>
        </>
    );
};

export default RoomCreateModal;