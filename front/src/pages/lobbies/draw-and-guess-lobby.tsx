import { useEffect, useState, FC } from 'react';
import { Button, Space, Input, Typography, Table } from 'antd';
import {
    RollbackOutlined,
    RightCircleOutlined,
    LockOutlined,
    UnlockOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import icon from '../../assets/Game-Icon.png';
import type { ColumnsType } from 'antd/es/table';
import RoomCreateModal from '../../components/create-room-modal';
import '../../styles/pages/lobbies/draw-and-guess-lobby.css';
import { useSocket } from '../../hooks/useSocket';

type RoomStatus = 'open' | 'full' | 'in progress';

interface PlayerInfo {
    username: string;
    socketId: string;
    score: number;
}

interface RoomInfo {
    roomId: string;
    roomName: string;
    owner: PlayerInfo;
    status: RoomStatus;
    currentSize: number;
    maxSize: number;
    maxRound: number;
    isPrivate: boolean;
}

const LobbyPage: FC = () => {
    const { socket } = useSocket();
    const [roomList, setRoomList] = useState<RoomInfo[]>([]);
    const username = sessionStorage.getItem('username');
    const navigate = useNavigate();

    useEffect(() => {
        socket.emit('clientJoinDrawAndGuessLobby');

        socket.on('updateDrawAndGuessLobbyRoomList', (rooms: RoomInfo[]) => {
            console.log('updateDrawAndGuessLobbyRoomList event received!');
            setRoomList(rooms);
        });
    }, []);

    const handleOnPlayNowBtnClick = () => {
        console.log('Join a random public room!');
    };

    const handleOnCreateRoomBtnClick = () => {
        const dataBody = { username: username };

        fetch('http://localhost:3000/room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataBody),
        })
            .then(function (response: Response) {
                if (response.status === 200) {
                    response.json().then(function ({ roomId }) {
                        navigate(`/Room/${roomId}`);
                    });
                } else {
                    response.json().then(function ({ error }) {
                        console.log(error);
                    });
                }
            })
            .catch(function (error: any) {
                console.log(error);
            });
    };

    return (
        <div className="lobby-layout">
            <div className="lobby-container">
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
                    <Typography className="draw-and-guess-lobby-header-text">
                        Draw & Guess
                    </Typography>
                </Space>

                <Space
                    size={'middle'}
                    className="draw-and-guess-lobby-btn-group"
                >
                    <Button
                        type="primary"
                        className="action-button"
                        ghost
                        onClick={handleOnPlayNowBtnClick}
                        icon={<RightCircleOutlined />}
                    >
                        Play Now!
                    </Button>

                    <RoomCreateModal
                        handleOnCreateRoomBtnClick={handleOnCreateRoomBtnClick}
                    />

                    <Button
                        type="primary"
                        className="action-button"
                        danger
                        ghost
                        onClick={() => navigate('/')}
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

export default LobbyPage;

const columns: ColumnsType<RoomInfo> = [
    {
        title: 'Room Name',
        dataIndex: 'roomName',
        key: 'roomName',
        width: 200,
    },
    {
        title: 'Owner',
        dataIndex: 'owner',
        key: 'owner',
        width: 150,
    },
    {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        align: 'center',
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
        width: 150,
    },
    {
        title: 'Seats',
        key: 'seats',
        align: 'center',
        width: 150,
        render: (_, record: RoomInfo) =>
            `${record.currentSize} / ${record.maxSize}`,
    },
    {
        title: 'Room Type',
        dataIndex: 'roomType',
        key: 'roomType',
        align: 'center',
        render: (_, record: RoomInfo) => (
            <>
                {record.isPrivate ? (
                    <LockOutlined style={{ fontSize: '16px', color: 'red' }} />
                ) : (
                    <UnlockOutlined
                        style={{ fontSize: '16px', color: 'green' }}
                    />
                )}
            </>
        ),
        width: 150,
    },
    {
        title: 'Action',
        key: 'action',
        align: 'center',
        width: 100,
        render: (_, record: RoomInfo) => (
            <Link to={`/Room/${record.roomId}`}>
                <Button
                    type="primary"
                    disabled={
                        record.status !== 'open' ||
                        record.currentSize >= record.maxSize
                    }
                    style={{
                        backgroundColor: '#FED382',
                        color: '#000000',
                    }}
                >
                    Join
                </Button>
            </Link>
        ),
    },
];
