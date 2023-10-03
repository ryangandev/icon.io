import { useEffect, useState, FC } from 'react';
import { Button, Space, Input, Typography, Table } from 'antd';
import { RollbackOutlined } from '@ant-design/icons';
import { Link, useNavigate, NavigateFunction } from 'react-router-dom';
import icon from '../assets/Game-Icon.png';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import '../styles/LobbyPage.css';
import RoomCreateModal from '../../components/RoomCreateModal';

interface RoomStatus {
    roomId: string;
    seats: string;
    status: string;
}

// don't throw error if status code not 200 level
axios.defaults.validateStatus = () => true;

const LobbyPage: FC = () => {
    const { Search } = Input;
    const [rooms, setRooms] = useState<RoomStatus[]>([]);
    const [search, setSearch] = useState<number>();
    const [createResponseMessage, setCreateResponseMessage] =
        useState<string>('');

    const username = localStorage.getItem('username');
    const navigate: NavigateFunction = useNavigate();

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
    }, [search]);

    const handleSearchOnchange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        setSearch(Number(e.target.value));
    };

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
                        setCreateResponseMessage(error);
                    });
                }
            })
            .catch(function (error: any) {
                setCreateResponseMessage(error);
            });
    };

    const columns: ColumnsType<RoomStatus> = [
        {
            title: 'Room ID',
            dataIndex: 'roomId',
            align: 'center',
        },
        {
            title: 'Seats',
            dataIndex: 'seats',
            align: 'center',
        },
        {
            title: 'Status',
            dataIndex: 'status',
            align: 'center',
            render: (status: boolean) =>
                status ? 'In progress' : 'Waiting for players',
        },
        {
            title: 'Join',
            dataIndex: '',
            align: 'center',
            render: (_, record: RoomStatus) => (
                <Link to={`/Room/${record.roomId}`}>
                    <Button
                        type="primary"
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
        <>
            <div className="lobby-container">
                <div className="header-container">
                    <Link to="/Home">
                        <Button
                            type="text"
                            style={{
                                width: 175,
                                height: 75,
                                fontSize: 40,
                                marginTop: '25px',
                            }}
                        >
                            <RollbackOutlined />
                            Back
                        </Button>
                    </Link>
                </div>

                <div className="room-select-container">
                    <Space style={{ marginBottom: 50 }}>
                        <img
                            style={{ width: 60, height: 60, marginRight: 20 }}
                            src={icon}
                            alt="logo"
                        />
                        <Typography
                            style={{ fontSize: 40, fontWeight: 'bold' }}
                        >
                            Draw & Guess
                        </Typography>
                    </Space>
                    <Typography
                        style={{
                            fontSize: 25,
                            fontWeight: 'bold',
                            textAlign: 'center',
                        }}
                    >
                        Select a room to join
                    </Typography>

                    <Search
                        placeholder="Search Room by ID"
                        size="large"
                        allowClear
                        onChange={handleSearchOnchange}
                        style={{ width: 250, float: 'right', marginTop: 25 }}
                    />
                    <Table
                        style={{
                            width: 800,
                            marginTop: 25,
                            borderRadius: 10,
                            boxShadow: '0px 0px 10px 0px rgba(0,0,0,0.25)',
                        }}
                        columns={columns}
                        dataSource={rooms}
                        rowClassName={(record, index) =>
                            index % 2 === 0 ? 'row-even' : 'row-odd'
                        }
                    />

                    <Space>
                        <Button
                            type="primary"
                            className="action-button"
                            onClick={handleOnPlayNowBtnClick}
                        >
                            Play Now!
                        </Button>

                        <RoomCreateModal
                            handleOnCreateRoomBtnClick={
                                handleOnCreateRoomBtnClick
                            }
                        />
                    </Space>
                    <Space>
                        <p>{createResponseMessage}</p>
                    </Space>
                </div>
            </div>
        </>
    );
};

export default LobbyPage;
