import { FC, useState } from 'react';

interface Props {
    color: string;
    img: string;
}

function darken(color: string, amount: number): string {
    // Convert color to RGB
    const rgb = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);

    if (!rgb) {
        throw new Error(`Invalid color value: ${color}`);
    }

    const r = parseInt(rgb[1], 16);
    const g = parseInt(rgb[2], 16);
    const b = parseInt(rgb[3], 16);

    // Calculate new RGB values
    const newR = Math.max(0, Math.min(255, Math.round(r * (1 - amount))));
    const newG = Math.max(0, Math.min(255, Math.round(g * (1 - amount))));
    const newB = Math.max(0, Math.min(255, Math.round(b * (1 - amount))));

    // Convert new RGB values back to hex color string
    const hex = ((newR << 16) | (newG << 8) | newB).toString(16);

    return `#${hex.padStart(6, '0')}`;
}

const GameSelect: FC<Props> = (props) => {
    const [isHovered, setIsHovered] = useState(false);

    const handleMouseEnter = () => {
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    const backgroundColor = isHovered ? darken(props.color, 0.2) : props.color;

    return (
        <img
            src={props.img}
            alt="logo"
            style={{
                width: 300,
                height: 300,
                borderRadius: 10,
                border: '1px solid black',
                boxShadow: '0 0 10px 0 rgba(0, 0, 0, 0.5)',
                backgroundColor: backgroundColor,
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        />
    );
};

export default GameSelect;
