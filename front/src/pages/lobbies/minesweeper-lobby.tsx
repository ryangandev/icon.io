import { useEffect, useRef, useState } from 'react';
import { Button, Form, Select, Space, Typography, Table } from 'antd';
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
import type {
  GameType,
  LobbyRoomInfo,
  MinesweeperLobbyRoomInfo,
  RoomCreateRequestBody,
} from '../../models/types';
import toast from 'react-hot-toast';
import PasswordPromptModal from '../../components/password-prompt-modal';
import { statusColors } from '../../libs/utils';
import { emit, off, on } from '../../libs/socket-events';

const GAME_TYPE: GameType = 'minesweeper';

/** Kept next to the label so the table says what a difficulty actually means. */
const BOARD_SIZES: Record<string, string> = {
  Small: '9 × 9 · 10 mines',
  Medium: '16 × 16 · 40 mines',
  Large: '30 × 16 · 99 mines',
};

const renderTotalRooms = (rooms: readonly MinesweeperLobbyRoomInfo[]) => (
  <div className="draw-and-guess-lobby-info-table-footer">
    Total Rooms: {rooms.length}
  </div>
);

const MinesweeperLobby = () => {
  const { socket } = useSocket();
  const username = sessionStorage.getItem('username');
  const [roomList, setRoomList] = useState<MinesweeperLobbyRoomInfo[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [createRoomRequestLoading, setCreateRoomRequestLoading] =
    useState(false);
  const [pendingRoom, setPendingRoom] =
    useState<MinesweeperLobbyRoomInfo | null>(null);
  const createdRoomPasswordRef = useRef('');
  const navigate = useNavigate();

  useEffect(() => {
    emit(socket, 'lobby:subscribe', GAME_TYPE);

    on(socket, 'lobby:rooms', (gameType: GameType, rooms: LobbyRoomInfo[]) => {
      if (gameType !== GAME_TYPE) return;
      setRoomList(rooms as MinesweeperLobbyRoomInfo[]);
    });

    on(socket, 'room:created', (roomId: string) => {
      setCreateRoomRequestLoading(false);
      emit(
        socket,
        'room:join',
        roomId,
        username,
        createdRoomPasswordRef.current,
      );
      createdRoomPasswordRef.current = '';
    });

    on(socket, 'room:joined', (roomId: string) => {
      toast.success('Joining room...');
      navigate(`/Gamehub/Minesweeper/Room/${roomId}`);
    });

    on(socket, 'room:join:denied', (data: { message: string }) => {
      toast.error(data.message);
    });

    return () => {
      emit(socket, 'lobby:unsubscribe', GAME_TYPE);
      off(socket, 'lobby:rooms');
      off(socket, 'room:created');
      off(socket, 'room:joined');
      off(socket, 'room:join:denied');
    };
  }, [socket, username, navigate]);

  const onCreate = (roomCreateRequest: RoomCreateRequestBody) => {
    createdRoomPasswordRef.current = roomCreateRequest.password ?? '';
    emit(socket, 'room:create', roomCreateRequest);
    setFormOpen(false);
  };

  const onJoinRoom = (record: MinesweeperLobbyRoomInfo) => {
    if (record.status !== 'Open') {
      toast.error('The room you are trying to join is not open.');
      return;
    }
    if (record.hasPassword) {
      setPendingRoom(record);
      return;
    }
    emit(socket, 'room:join', record.roomId, username);
  };

  const onPasswordSubmit = (password: string) => {
    if (!pendingRoom) return;
    emit(socket, 'room:join', pendingRoom.roomId, username, password);
    setPendingRoom(null);
  };

  const columns: ColumnsType<MinesweeperLobbyRoomInfo> = [
    {
      title: 'Room Name',
      dataIndex: 'roomName',
      key: 'roomName',
      width: 190,
    },
    {
      title: 'Owner',
      key: 'owner',
      width: 150,
      render: (_, record) => (
        <Typography.Text>{record.owner.username}</Typography.Text>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      align: 'center',
      width: 120,
      render: (_, record) => (
        <Typography.Text style={{ color: statusColors[record.status] }}>
          {record.status}
        </Typography.Text>
      ),
    },
    {
      title: 'Board',
      key: 'difficulty',
      align: 'center',
      width: 175,
      render: (_, record) => (
        <Typography.Text>
          {record.difficulty}
          <br />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {BOARD_SIZES[record.difficulty]}
          </Typography.Text>
        </Typography.Text>
      ),
    },
    {
      title: 'Seats',
      key: 'seats',
      align: 'center',
      width: 110,
      render: (_, record) =>
        `${record.currentPlayerCount} / ${record.maxPlayers}`,
    },
    {
      title: 'Password?',
      key: 'roomType',
      align: 'center',
      width: 115,
      render: (_, record) =>
        record.hasPassword ? (
          <LockOutlined style={{ fontSize: '16px', color: 'red' }} />
        ) : (
          <UnlockOutlined style={{ fontSize: '16px', color: 'green' }} />
        ),
    },
    {
      title: 'Action',
      key: 'action',
      align: 'center',
      width: 100,
      render: (_, record) => (
        <Button
          type="primary"
          danger={record.hasPassword}
          onClick={() => onJoinRoom(record)}
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
            Minesweeper
          </Typography.Text>
        </Space>

        <Space size={'middle'} className="draw-and-guess-lobby-btn-group">
          <Button
            type="primary"
            onClick={() => setFormOpen(true)}
            icon={<PlusCircleOutlined />}
          >
            Create Room
          </Button>

          {/* Board size is Minesweeper's own setting, so it is passed in as a
              field rather than baked into the shared form. */}
          <RoomCreateForm
            gameType={GAME_TYPE}
            open={formOpen}
            confirmLoading={createRoomRequestLoading}
            setConfirmLoading={setCreateRoomRequestLoading}
            onCancel={() => setFormOpen(false)}
            onCreate={onCreate}
            settingsDefaults={{ difficulty: 'Medium' }}
          >
            <Form.Item
              name="difficulty"
              label="Board"
              rules={[{ required: true, message: 'Select is required!' }]}
            >
              <Select style={{ minWidth: 190 }}>
                {Object.entries(BOARD_SIZES).map(([name, size]) => (
                  <Select.Option key={name} value={name}>
                    {name} — {size}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </RoomCreateForm>

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
          footer={renderTotalRooms}
          pagination={false}
          bordered
          rowKey={(record) => record.roomId}
          scroll={{ y: 400 }}
          rowClassName={(_record, index) =>
            index % 2 === 0 ? 'row-even' : 'row-odd'
          }
        />

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

export default MinesweeperLobby;
