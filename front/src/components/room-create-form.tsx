import { Input, Modal, Select, Typography } from 'antd';
import '../styles/pages/lobbies/draw-and-guess-lobby.css';
import { Form } from 'antd';
import type { GameType, RoomCreateRequestBody } from '../models/types';

interface RoomCreateFormProps {
  /** Which game the room will play. Goes on the request; also picks the module. */
  gameType: GameType;
  open: boolean;
  confirmLoading: boolean;
  setConfirmLoading: (confirmLoading: boolean) => void;
  onCancel: () => void;
  onCreate: (requestBody: RoomCreateRequestBody) => void;
  /**
   * The game's own fields, rendered between the seat count and the owner.
   * Whatever they are named, their values become the request's `settings` —
   * which is the only part of a create request the server hands to a module.
   */
  children?: React.ReactNode;
  /** Initial values for those fields. */
  settingsDefaults?: Record<string, unknown>;
}

const { Option } = Select;

const RoomCreateForm = ({
  gameType,
  open,
  onCancel,
  onCreate,
  confirmLoading,
  setConfirmLoading,
  children,
  settingsDefaults = {},
}: RoomCreateFormProps) => {
  const [form] = Form.useForm();
  const username = sessionStorage.getItem('username');
  const maxPlayersOptions = [2, 3, 4, 5, 6, 7, 8];

  return (
    <Modal
      open={open}
      title={
        <Typography.Text style={{ fontSize: 20, fontWeight: 600 }}>
          Creating a new room
        </Typography.Text>
      }
      okText="Create"
      cancelText="Cancel"
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
      onOk={() => {
        setConfirmLoading(true);
        form
          .validateFields()
          .then((values: Record<string, unknown>) => {
            form.resetFields();

            // Everything the room layer does not name is the game's.
            const {
              roomName,
              ownerUsername,
              maxPlayers,
              password,
              ...settings
            } = values;

            onCreate({
              gameType,
              roomName: roomName as string,
              ownerUsername: ownerUsername as string,
              maxPlayers: maxPlayers as number,
              password: (password as string) ?? '',
              settings,
            });
          })
          .catch((info) => {
            console.log('Validate Failed:', info);
          });
      }}
      confirmLoading={confirmLoading}
      width={550}
      getContainer={document.getElementById('app')!} // Manually telling the modal dialog to render within root DOM
      destroyOnHidden={true} // Destroy modal on close ensure that autoFocus eveytime the modal is opened
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
          roomName: username + "'s Room",
          ownerUsername: username,
          maxPlayers: 8,
          password: '',
          ...settingsDefaults,
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
            autoFocus
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

        {children}

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
