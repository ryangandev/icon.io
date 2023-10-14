import { useEffect, useState } from 'react';
import { Button, Space, Typography, Table } from 'antd';
import {
    RollbackOutlined,
    LockOutlined,
    UnlockOutlined,
    PlusCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import icon from '../../assets/Game-Icon.png';
import RoomCreateForm from '../../components/room-create-form';
import '../../styles/pages/lobbies/draw-and-guess-lobby.css';
import { useSocket } from '../../hooks/useSocket';
import { RoomCreateRequestBody, RoomInfo } from '../../models/types';
import toast from 'react-hot-toast';
import PasswordPromptModal from '../../components/password-prmopt-modal';

const DrawAndGuessLobby = () => {
    const { socket } = useSocket();
    const username = sessionStorage.getItem('username');
    const [roomList, setRoomList] = useState<RoomInfo[]>([]);
    const [formOpen, setFormOpen] = useState(false);
    const [passwordPromptOpen, setPasswordPromptOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        socket.emit('clientJoinDrawAndGuessLobby');

        socket.on('updateDrawAndGuessLobbyRoomList', (rooms: RoomInfo[]) => {
            console.log(
                'updateDrawAndGuessLobbyRoomList event received! Current Rooms are: ',
                rooms,
            );
            setRoomList(rooms);
        });

        socket.on(
            'createDrawAndGuessRoomSuccess',
            (room: RoomInfo, password: string) => {
                console.log(
                    'createDrawAndGuessRoomSuccess event received! Room is: ',
                    room,
                    ' and password is: ',
                    password,
                );
                socket.emit(
                    'clientJoinDrawAndGuessRoomRequest',
                    room.roomId,
                    username,
                    password,
                );
            },
        );

        socket.on(
            'approveClientJoinDrawAndGuessRoomRequest',
            (roomId: string) => {
                console.log(
                    'approveClientJoinDrawAndGuessRoomRequest event received! Room ID is: ',
                    roomId,
                );
                toast.success('Joining room...');
                navigate(`/Gamehub/DrawAndGuess/Room/${roomId}`);
            },
        );

        socket.on('rejectClientJoinDrawAndGuessRoomRequest', (data) => {
            console.log(
                'rejectClientJoinDrawAndGuessRoomRequest event received! Error message is: ',
                data.message,
            );
            toast.error(data.message);
        });

        return () => {
            socket.off('updateDrawAndGuessLobbyRoomList');
            socket.off('createDrawAndGuessRoomSuccess');
            socket.off('approveClientJoinDrawAndGuessRoomRequest');
            socket.off('rejectClientJoinDrawAndGuessRoomRequest');
        };
    }, [socket, username, navigate]);

    const onCreate = (drawAndGuessRoomCreateRequest: RoomCreateRequestBody) => {
        console.log(
            'Received values from form: ',
            drawAndGuessRoomCreateRequest,
        );

        socket.emit(
            'createDrawAndGuessRoomRequest',
            drawAndGuessRoomCreateRequest,
        );
        setFormOpen(false);
    };

    const onJoinRoom = (record: RoomInfo) => {
        if (record.status === 'open') {
            if (record.password) {
                setPasswordPromptOpen(true);
            } else {
                socket.emit(
                    'clientJoinDrawAndGuessRoomRequest',
                    record.roomId,
                    username,
                );
            }
        } else {
            toast.error('The room you are trying to join is not open.');
        }
    };

    const onPasswordSubmit = (record: RoomInfo, password: string) => {
        socket.emit(
            'clientJoinDrawAndGuessRoomRequest',
            record.roomId,
            username,
            password,
        );
    };

    const columns: ColumnsType<RoomInfo> = [
        {
            title: 'Room Name',
            dataIndex: 'roomName',
            key: 'roomName',
            width: 200,
        },
        {
            title: 'Owner',
            key: 'owner',
            width: 175,
            render: (_, record: RoomInfo) => (
                <Typography.Text>{record.owner.username}</Typography.Text>
            ),
        },
        {
            title: 'Status',
            key: 'status',
            align: 'center',
            width: 125,
            render: (_, record: RoomInfo) => (
                <>
                    {record.status === 'open' ? (
                        <Typography.Text style={{ color: 'green' }}>
                            Open
                        </Typography.Text>
                    ) : record.status === 'full' ? (
                        <Typography.Text style={{ color: 'red' }}>
                            Full
                        </Typography.Text>
                    ) : (
                        <Typography.Text style={{ color: 'orange' }}>
                            In Progress
                        </Typography.Text>
                    )}
                </>
            ),
        },
        {
            title: 'Rounds',
            dataIndex: 'rounds',
            key: 'rounds',
            align: 'center',
            width: 125,
        },
        {
            title: 'Seats',
            key: 'seats',
            align: 'center',
            width: 125,
            render: (_, record: RoomInfo) =>
                `${record.currentPlayerCount} / ${record.maxPlayers}`,
        },
        {
            title: 'Password?',
            dataIndex: 'roomType',
            key: 'roomType',
            align: 'center',
            width: 125,
            render: (_, record: RoomInfo) => (
                <>
                    {record.password ? (
                        <LockOutlined
                            style={{ fontSize: '16px', color: 'red' }}
                        />
                    ) : (
                        <UnlockOutlined
                            style={{ fontSize: '16px', color: 'green' }}
                        />
                    )}
                </>
            ),
        },
        {
            title: 'Action',
            key: 'action',
            align: 'center',
            width: 100,
            render: (_, record: RoomInfo) => (
                <>
                    <Button
                        type="primary"
                        danger={record.password !== ''}
                        onClick={() => {
                            onJoinRoom(record);
                        }}
                        disabled={
                            record.status !== 'open' ||
                            record.currentPlayerCount >= record.maxPlayers
                        }
                    >
                        Join
                    </Button>
                    <PasswordPromptModal
                        open={passwordPromptOpen}
                        onCancel={() => setPasswordPromptOpen(false)}
                        onPasswordSubmit={(passwordEntered) =>
                            onPasswordSubmit(record, passwordEntered)
                        }
                    />
                </>
            ),
        },
    ];

    return (
        <div className="draw-and-guess-lobby-layout">
            <div className="draw-and-guess-lobby-container">
                <Space
                    size="large"
                    direction="horizontal"
                    align="center"
                    className="draw-and-guess-lobby-header"
                >
                    <img
                        className="draw-and-guess-lobby-header-icon"
                        src={icon}
                        alt="logo"
                    />
                    <Typography.Text className="draw-and-guess-lobby-header-text">
                        Draw & Guess
                    </Typography.Text>
                </Space>

                <Space
                    size={'middle'}
                    className="draw-and-guess-lobby-btn-group"
                >
                    <Button
                        type="primary"
                        onClick={() => {
                            setFormOpen(true);
                        }}
                        icon={<PlusCircleOutlined />}
                    >
                        Create Room
                    </Button>
                    <RoomCreateForm
                        open={formOpen}
                        onCancel={() => setFormOpen(false)}
                        onCreate={onCreate}
                    />

                    <Button
                        type="primary"
                        danger
                        onClick={() => navigate('/Gamehub')}
                        icon={<RollbackOutlined />}
                    >
                        Back
                    </Button>
                </Space>

                <Table
                    className="draw-and-guess-lobby-info-table"
                    columns={columns}
                    dataSource={roomList}
                    footer={() => (
                        <div className="draw-and-guess-lobby-info-table-footer">
                            Total Rooms: {roomList.length}
                        </div>
                    )}
                    pagination={false}
                    bordered
                    rowKey={(record) => record.roomId}
                    scroll={{ y: 400 }} // table max height
                    rowClassName={(record, index) =>
                        index % 2 === 0 ? 'row-even' : 'row-odd'
                    }
                />
            </div>
        </div>
    );
};

export default DrawAndGuessLobby;
