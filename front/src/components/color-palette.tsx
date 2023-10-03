import { useState } from 'react';

interface ColorSquareProps {
    color: string;
    onClick: () => void;
}

interface ColorPaletteProps {
    handleColorChange: (color: string) => void;
}

const ColorSquare: React.FC<ColorSquareProps> = (props: ColorSquareProps) => {
    return (
        <div
            className="color-square"
            onClick={props.onClick}
            style={{ backgroundColor: props.color }}
        ></div>
    );
};

const ColorPalette: React.FC<ColorPaletteProps> = (
    props: ColorPaletteProps,
) => {
    const colors = [
        '#000000',
        '#ff0000',
        '#ff6600',
        '#ffcc00',
        '#ffff00',
        '#00ff00',
        '#00ffff',
        '#0000ff',
        '#6600ff',
        '#ff00ff',
        '#ff1493',
        '#bfbfbf',
        '#808080',
        '#4d4d4d',
        '#ffffff',
        '#e6b8af',
        '#f4cccc',
        '#fce5cd',
        '#fff2cc',
        '#d9ead3',
        '#d0e0e3',
        '#c9daf8',
    ];

    const [selectedColor, setSelectedColor] = useState('#000000');

    const handleColorChange = (color: string) => {
        setSelectedColor(color);
        props.handleColorChange(color);
    };

    return (
        <div className="color-toolbar">
            <div
                className="select-color-square"
                style={{ backgroundColor: selectedColor }}
            ></div>
            <div className="color-palette">
                {colors.map((color, index) => {
                    return (
                        <ColorSquare
                            key={index}
                            onClick={() => handleColorChange(color)}
                            color={color}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default ColorPalette;
