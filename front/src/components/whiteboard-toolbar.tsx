import '../styles/components/whiteboard-toolbar.css';
import { DeleteOutlined, RollbackOutlined } from '@ant-design/icons';
import { Button, Space } from 'antd';
import { useState } from 'react';
import { colors } from '../data/color';

interface WhiteBoardToolBarProps {
    brushSizes: { [key: string]: number };
    handleColorChange: (color: string) => void;
    handleBrushChange: (brushOption: number) => void;
    handleClearCanvas: () => void;
    handleUndo: () => void;
}

const WhiteBoardToolBar: React.FC<WhiteBoardToolBarProps> = ({
    brushSizes,
    handleColorChange,
    handleBrushChange,
    handleClearCanvas,
    handleUndo,
}: WhiteBoardToolBarProps) => {
    return (
        <div className="white-board-toolbar-layout">
            <ColorPalette handleColorChange={handleColorChange} />
            <BrushPicker
                brushSizes={brushSizes}
                handleBrushChange={handleBrushChange}
            />
            <Space size={'small'}>
                <Button
                    className="whiteboard-toolbar-button"
                    onClick={handleUndo}
                    size="large"
                    icon={<RollbackOutlined />}
                />

                <Button
                    className="whiteboard-toolbar-button"
                    onClick={handleClearCanvas}
                    size="large"
                    icon={<DeleteOutlined />}
                />
            </Space>
        </div>
    );
};

const ColorSquare = ({
    color,
    onClick,
}: {
    color: string;
    onClick: () => void;
}) => {
    return (
        <Button
            className="whiteboard-toolbar-color-square"
            onClick={onClick}
            style={{ padding: 0, backgroundColor: color }}
        />
    );
};

const ColorPalette = ({
    handleColorChange,
}: {
    handleColorChange: (color: string) => void;
}) => {
    const [selectedColor, setSelectedColor] = useState('#000000');

    const onColorChange = (color: string) => {
        setSelectedColor(color);
        handleColorChange(color);
    };

    return (
        <div className="whiteboard-toolbar-color-palette-container">
            <div
                className="whiteboard-toolbar-selected-color"
                style={{ backgroundColor: selectedColor }}
            />
            <div className="whiteboard-toolbar-color-palette">
                {colors.map((color, index) => {
                    return (
                        <ColorSquare
                            key={index}
                            onClick={() => onColorChange(color)}
                            color={color}
                        />
                    );
                })}
            </div>
        </div>
    );
};

const BrushPicker = ({
    brushSizes,
    handleBrushChange,
}: {
    brushSizes: { [key: string]: number };
    handleBrushChange: (brushOption: number) => void;
}) => {
    const [selectedBrushOption, setSelectedBrushOption] = useState(1);
    const brushOptions = Array.from(
        { length: Object.keys(brushSizes).length },
        (_, i) => i + 1,
    );

    return (
        <Space direction="horizontal">
            {brushOptions.map((brushOption) => (
                <Button
                    key={brushOption}
                    size="large"
                    className="brush-picker"
                    style={{
                        padding: 0,
                        backgroundColor:
                            selectedBrushOption === brushOption
                                ? '#5ab8d770'
                                : '#ffe4c4',
                    }}
                    onClick={() => {
                        handleBrushChange(brushOption);
                        setSelectedBrushOption(brushOption);
                    }}
                >
                    <span
                        style={{
                            width: brushSizes[brushOption.toString()] / 1.5,
                            height: brushSizes[brushOption.toString()] / 1.5,
                            backgroundColor: 'black',
                            borderRadius: '50%',
                        }}
                    />
                </Button>
            ))}
        </Space>
    );
};

export default WhiteBoardToolBar;
