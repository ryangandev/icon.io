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
import axios from 'axios';
import RoomCreateModal from '../../components/create-room-modal';
import '../../styles/pages/lobbies/draw-and-guess-lobby.css';

interface RoomInfo {
    roomId: string;
    roomName: string;
    roomType: 'locked' | 'unlocked';
    numberOfSeatsTaken: number;
    totalSeats: number;
    owner: string;
    status: 'open' | 'full' | 'in progress';
}
const roomList: RoomInfo[] = [
    {
        roomId: '1',
        roomName: 'Room2222222 Alpha',
        roomType: 'unlocked',
        numberOfSeatsTaken: 3,
        totalSeats: 6,
        owner: 'Alice',
        status: 'open',
    },
    {
        roomId: '2',
        roomName: 'Room Bravo',
        roomType: 'unlocked',
        numberOfSeatsTaken: 5,
        totalSeats: 5,
        owner: 'Bob',
        status: 'full',
    },
    {
        roomId: '3',
        roomName: 'Room Charlie',
        roomType: 'unlocked',
        numberOfSeatsTaken: 2,
        totalSeats: 4,
        owner: 'Charlie',
        status: 'in progress',
    },
    {
        roomId: '4',
        roomName: 'Room Delta',
        roomType: 'locked',
        numberOfSeatsTaken: 0,
        totalSeats: 6,
        owner: 'Dave',
        status: 'open',
    },
    {
        roomId: '5',
        roomName: 'Room Alpha',
        roomType: 'locked',
        numberOfSeatsTaken: 3,
        totalSeats: 6,
        owner: 'Alice',
        status: 'open',
    },
    {
        roomId: '6',
        roomName: 'Room Bravo',
        roomType: 'locked',
        numberOfSeatsTaken: 5,
        totalSeats: 5,
        owner: 'Bob',
        status: 'full',
    },
    {
        roomId: '7',
        roomName: 'Room Charlie',
        roomType: 'locked',
        numberOfSeatsTaken: 2,
        totalSeats: 4,
        owner: 'Charlie',
        status: 'in progress',
    },
    {
        roomId: '8',
        roomName: 'Room Delta',
        roomType: 'locked',
        numberOfSeatsTaken: 0,
        totalSeats: 6,
        owner: 'Dave',
        status: 'open',
    },
    // ... (more rooms)
];

const LobbyPage: FC = () => {
    const [rooms, setRooms] = useState<RoomInfo[]>([]);
    const username = sessionStorage.getItem('username');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchRooms = async () => {
            try {
                const response = await axios.get(`http://localhost:3000/rooms`);
                if (response.status === 200) {
                    const rooms = await response.data;
                    setRooms(rooms);
                } else {
                    console.log('Error from fetching rooms');
                }
            } catch (error) {
                console.log(error);
            }
        };
        fetchRooms();

        // Set an interval to periodically fetch rooms
        const intervalId = setInterval(() => {
            fetchRooms();
        }, 3000);

        // Clean up
        return () => {
            clearInterval(intervalId);
        };
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
                `${record.numberOfSeatsTaken} / ${record.totalSeats}`,
        },
        {
            title: 'Room Type',
            dataIndex: 'roomType',
            key: 'roomType',
            align: 'center',
            render: (_, record: RoomInfo) => (
                <>
                    {record.roomType === 'locked' ? (
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
                            record.numberOfSeatsTaken >= record.totalSeats
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
                    // pagination={false}
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
