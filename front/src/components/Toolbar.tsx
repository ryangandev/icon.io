import ColorPalette from './ColorPalette';
import '../styles/Toolbar.css';
import { DeleteOutlined, RollbackOutlined } from '@ant-design/icons';
import { Button, Space } from 'antd';
import BrushPicker from './BrushPicker';

interface ToolBarProps {
    brushSizes: { [key: string]: number };
    handleColorChange: (color: string) => void;
    handleBrushChange: (brushOption: number) => void;
    handleClearCanvas: () => void;
    handleUndo: () => void;
}

const ToolBar: React.FC<ToolBarProps> = (props: ToolBarProps) => {
    return (
        <Space
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: '100%',
            }}
        >
            <Space>
                <ColorPalette handleColorChange={props.handleColorChange} />
                <BrushPicker
                    brushSizes={props.brushSizes}
                    handleBrushChange={props.handleBrushChange}
                />
            </Space>

            <Space>
                <Button
                    className="transparent-button"
                    onClick={props.handleUndo}
                >
                    <RollbackOutlined />
                </Button>

                <Button
                    className="transparent-button"
                    onClick={props.handleClearCanvas}
                >
                    <DeleteOutlined />
                </Button>
            </Space>
        </Space>
    );
};

export default ToolBar;
