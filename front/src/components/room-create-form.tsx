import { useState } from 'react';
import { Input, Modal, Select } from 'antd';
import '../styles/pages/lobbies/draw-and-guess-lobby.css';
import { Form } from 'antd';
import { RoomCreateRequestBody } from '../models/types';

interface RoomCreateFormProps {
    open: boolean;
    onCancel: () => void;
    onCreate: (requestBody: RoomCreateRequestBody) => void;
}

const { Option } = Select;

const RoomCreateForm = ({ open, onCancel, onCreate }: RoomCreateFormProps) => {
    const [form] = Form.useForm();
    const username = sessionStorage.getItem('username');
    const defaultRoomCreateRequest: RoomCreateRequestBody = {
        roomName: 'Creating a new room...',
        ownerUsername: username!,
        rounds: 2,
        maxPlayers: 8,
        password: '',
    };
    const maxPlayersOptions = [2, 3, 4, 5, 6, 7, 8];
    const maxRoundsOptions = [1, 2, 3, 4];
    const [confirmLoading, setConfirmLoading] = useState(false);

    return (
        <Modal
            open={open}
            title={
                <span style={{ fontSize: 20, fontWeight: 600 }}>
                    Creating a new room
                </span>
            }
            okText="Create"
            cancelText="Cancel"
            onCancel={() => {
                form.resetFields();
                onCancel();
            }}
            onOk={() => {
                form.validateFields()
                    .then((createRoomRequest: RoomCreateRequestBody) => {
                        form.resetFields();
                        onCreate(createRoomRequest);
                    })
                    .catch((info) => {
                        console.log('Validate Failed:', info);
                    });
            }}
            confirmLoading={confirmLoading}
            width={550}
        >
            <Form
                form={form}
                layout="inline"
                style={{
                    marginTop: 20,
                    marginBottom: 20,
                    gap: '16px',
                }}
                name="roomCreateFormModal"
                initialValues={{
                    roomName: defaultRoomCreateRequest.roomName,
                    ownerUsername: defaultRoomCreateRequest.ownerUsername,
                    maxPlayers: defaultRoomCreateRequest.maxPlayers,
                    rounds: defaultRoomCreateRequest.rounds,
                    password: defaultRoomCreateRequest.password,
                }}
            >
                <Form.Item
                    name="roomName"
                    label="Room Name"
                    rules={[
                        {
                            required: true,
                            message: 'Room name is required!',
                        },
                    ]}
                >
                    <Input
                        placeholder="Enter a name for your room"
                        showCount
                        maxLength={40}
                        style={{ width: 350 }}
                    />
                </Form.Item>

                <Form.Item
                    name="maxPlayers"
                    label="Max Players"
                    rules={[
                        {
                            required: true,
                            message: 'Select is required!',
                        },
                    ]}
                >
                    <Select>
                        {maxPlayersOptions.map((size) => (
                            <Option key={size} value={size}>
                                {size}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item
                    name="rounds"
                    label="Rounds"
                    rules={[
                        {
                            required: true,
                            message: 'Select is required!',
                        },
                    ]}
                >
                    <Select>
                        {maxRoundsOptions.map((round) => (
                            <Option key={round} value={round}>
                                {round}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item
                    name="ownerUsername"
                    label="Owner"
                    rules={[
                        {
                            required: true,
                            message: 'Owner username is required!',
                        },
                    ]}
                >
                    <Input disabled />
                </Form.Item>

                <Form.Item
                    name="password"
                    label="Password (Optional)"
                    rules={[
                        {
                            max: 20,
                            message: 'Password must be at most 20 characters!',
                        },
                    ]}
                >
                    <Input.Password
                        maxLength={20}
                        placeholder="Max 20 Characters"
                        showCount
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default RoomCreateForm;