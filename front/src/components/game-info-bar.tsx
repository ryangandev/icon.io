import '../styles/components/game-info-bar.css';
import { Button } from 'antd';
import {
    FieldTimeOutlined,
    LogoutOutlined,
    SettingOutlined,
} from '@ant-design/icons';

interface GameInfoBarProps {
    handleOnLeave: () => void;
}

const GameInfoBar: React.FC<GameInfoBarProps> = ({
    handleOnLeave,
}: GameInfoBarProps) => {
    return (
        <div className="game-info-container">
            <div className="game-info-container-left">
                <FieldTimeOutlined style={{ fontSize: 32 }} />
                <span style={{ fontWeight: 500, fontSize: 24 }}>00:00</span>
            </div>
            <div className="game-info-container-center">
                <span style={{ fontWeight: 400, fontSize: 12 }}>Draw</span>
                <span style={{ fontWeight: 700, fontSize: 24 }}>H e l l o</span>
            </div>

            <div className="game-info-container-right">
                <Button
                    className="game-info-btn"
                    onClick={() => {}}
                    icon={<SettingOutlined style={{ fontSize: 32 }} />}
                />
                <Button
                    className="game-info-btn"
                    onClick={handleOnLeave}
                    icon={<LogoutOutlined style={{ fontSize: 32 }} />}
                />
            </div>
        </div>
    );
};

export default GameInfoBar;
