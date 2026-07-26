import { useEffect, useRef, useState } from 'react';
import { Button, Space, Typography, Table } from 'antd';
import {
    RollbackOutlined,
    LockOutlined,
    UnlockOutlined,
    PlusCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router';
import icon from '../../assets/Game-Icon.png';
import RoomCreateForm from '../../components/room-create-form';
import '../../styles/pages/lobbies/draw-and-guess-lobby.css';
import { useSocket } from '../../hooks/useSocket';
import type { RoomCreateRequestBody, RoomInfo } from '../../models/types';
import toast from 'react-hot-toast';
import PasswordPromptModal from '../../components/password-prmopt-modal';
import { statusColors } from '../../libs/utils';

const DrawAndGuessLobby = () => {
    const { socket } = useSocket();
    const username = sessionStorage.getItem('username');
    const [roomList, setRoomList] = useState<RoomInfo[]>([]);
    const [formOpen, setFormOpen] = useState(false);
    const [createRoomRequestLoading, setcreateRoomRequestLoading] =
        useState(false);
    // The locked room waiting on a password, or null when nothing is pending.
    // This used to be a bare boolean driving one modal per table row, so
    // clicking Join opened every locked room's modal at once.
    const [pendingRoom, setPendingRoom] = useState<RoomInfo | null>(null);
    // The password we just submitted, kept locally so the server never has to
    // echo it back to us in order for us to join the room we created.
    const createdRoomPasswordRef = useRef('');
    const navigate = useNavigate();

    useEffect(() => {
        socket.emit('clientJoinDrawAndGuessLobby');

        socket.on('updateDrawAndGuessLobbyRoomList', (rooms: RoomInfo[]) => {
            setRoomList(rooms);
        });

        socket.on('createDrawAndGuessRoomSuccess', (roomId: string) => {
            setcreateRoomRequestLoading(false);
            socket.emit(
                'clientJoinDrawAndGuessRoomRequest',
                roomId,
                username,
                createdRoomPasswordRef.current,
            );
            createdRoomPasswordRef.current = '';
        });

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
        createdRoomPasswordRef.current =
            drawAndGuessRoomCreateRequest.password ?? '';
        socket.emit(
            'createDrawAndGuessRoomRequest',
            drawAndGuessRoomCreateRequest,
        );
        setFormOpen(false);
    };

    const onJoinRoom = (record: RoomInfo) => {
        if (record.status === 'Open') {
            if (record.hasPassword) {
                setPendingRoom(record);
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

    const onPasswordSubmit = (password: string) => {
        if (!pendingRoom) return;

        socket.emit(
            'clientJoinDrawAndGuessRoomRequest',
            pendingRoom.roomId,
            username,
            password,
        );
        setPendingRoom(null);
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
                <Typography.Text style={{ color: statusColors[record.status] }}>
                    {record.status}
                </Typography.Text>
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
                    {record.hasPassword ? (
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
                <Button
                    type="primary"
                    danger={record.hasPassword}
                    onClick={() => {
                        onJoinRoom(record);
                    }}
                    disabled={
                        record.status !== 'Open' ||
                        record.currentPlayerCount >= record.maxPlayers
                    }
                >
                    Join
                </Button>
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
                        confirmLoading={createRoomRequestLoading}
                        setConfirmLoading={setcreateRoomRequestLoading}
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
                    rowClassName={(_record, index) =>
                        index % 2 === 0 ? 'row-even' : 'row-odd'
                    }
                />

                {/* One modal for the whole table, keyed so each room gets a
                    fresh, empty password field. */}
                <PasswordPromptModal
                    key={pendingRoom?.roomId}
                    open={pendingRoom !== null}
                    roomName={pendingRoom?.roomName ?? ''}
                    onCancel={() => setPendingRoom(null)}
                    onPasswordSubmit={onPasswordSubmit}
                />
            </div>
        </div>
    );
};

export default DrawAndGuessLobby;
