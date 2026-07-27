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
  DrawAndGuessLobbyRoomInfo,
  GameType,
  LobbyRoomInfo,
  RoomCreateRequestBody,
} from '../../models/types';
import toast from 'react-hot-toast';
import PasswordPromptModal from '../../components/password-prompt-modal';
import { statusColors } from '../../libs/utils';
import { emit, off, on } from '../../libs/socket-events';

const GAME_TYPE: GameType = 'draw-and-guess';

/**
 * antd calls this with the rows it is currently showing, so the count comes
 * from the table rather than from a variable captured out of the render.
 */
const renderTotalRooms = (rooms: readonly DrawAndGuessLobbyRoomInfo[]) => (
  <div className="draw-and-guess-lobby-info-table-footer">
    Total Rooms: {rooms.length}
  </div>
);

const DrawAndGuessLobby = () => {
  const { socket } = useSocket();
  const username = sessionStorage.getItem('username');
  const [roomList, setRoomList] = useState<DrawAndGuessLobbyRoomInfo[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [createRoomRequestLoading, setcreateRoomRequestLoading] =
    useState(false);
  // The locked room waiting on a password, or null when nothing is pending.
  // This used to be a bare boolean driving one modal per table row, so
  // clicking Join opened every locked room's modal at once.
  const [pendingRoom, setPendingRoom] =
    useState<DrawAndGuessLobbyRoomInfo | null>(null);
  // The password we just submitted, kept locally so the server never has to
  // echo it back to us in order for us to join the room we created.
  const createdRoomPasswordRef = useRef('');
  const navigate = useNavigate();

  useEffect(() => {
    // A lobby is a socket.io room per game now, so this both subscribes and
    // asks for the list. Every game's rooms used to go to every client.
    emit(socket, 'lobby:subscribe', GAME_TYPE);

    on(socket, 'lobby:rooms', (gameType: GameType, rooms: LobbyRoomInfo[]) => {
      if (gameType !== GAME_TYPE) return;
      setRoomList(rooms as DrawAndGuessLobbyRoomInfo[]);
    });

    on(socket, 'room:created', (roomId: string) => {
      setcreateRoomRequestLoading(false);
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
      navigate(`/Gamehub/DrawAndGuess/Room/${roomId}`);
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

  const onJoinRoom = (record: DrawAndGuessLobbyRoomInfo) => {
    if (record.status === 'Open') {
      if (record.hasPassword) {
        setPendingRoom(record);
      } else {
        emit(socket, 'room:join', record.roomId, username);
      }
    } else {
      toast.error('The room you are trying to join is not open.');
    }
  };

  const onPasswordSubmit = (password: string) => {
    if (!pendingRoom) return;

    emit(socket, 'room:join', pendingRoom.roomId, username, password);
    setPendingRoom(null);
  };

  const columns: ColumnsType<DrawAndGuessLobbyRoomInfo> = [
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
      render: (_, record) => (
        <Typography.Text>{record.owner.username}</Typography.Text>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      align: 'center',
      width: 125,
      render: (_, record) => (
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
      render: (_, record) =>
        `${record.currentPlayerCount} / ${record.maxPlayers}`,
    },
    {
      title: 'Password?',
      dataIndex: 'roomType',
      key: 'roomType',
      align: 'center',
      width: 125,
      render: (_, record) => (
        <>
          {record.hasPassword ? (
            <LockOutlined style={{ fontSize: '16px', color: 'red' }} />
          ) : (
            <UnlockOutlined style={{ fontSize: '16px', color: 'green' }} />
          )}
        </>
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

        <Space size={'middle'} className="draw-and-guess-lobby-btn-group">
          <Button
            type="primary"
            onClick={() => {
              setFormOpen(true);
            }}
            icon={<PlusCircleOutlined />}
          >
            Create Room
          </Button>
          {/* Rounds is Draw & Guess's own setting, so it is passed in as a
              field rather than baked into the shared form. Its value lands in
              the request's `settings`, which is the only part of a create
              request the server hands to a game. */}
          <RoomCreateForm
            gameType={GAME_TYPE}
            open={formOpen}
            confirmLoading={createRoomRequestLoading}
            setConfirmLoading={setcreateRoomRequestLoading}
            onCancel={() => setFormOpen(false)}
            onCreate={onCreate}
            settingsDefaults={{ rounds: 2 }}
          >
            <Form.Item
              name="rounds"
              label="Rounds"
              rules={[{ required: true, message: 'Select is required!' }]}
            >
              <Select>
                {[1, 2, 3, 4].map((round) => (
                  <Select.Option key={round} value={round}>
                    {round}
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
