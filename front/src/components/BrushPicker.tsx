import { Space } from 'antd';
import { useState } from 'react';

// const brushSizes: {[key: string]: number} = {
//     '1': 2,
//     '2': 6,
//     '3': 18,
//     '4': 35,
// };

interface BrushPickerProps {
    brushSizes: { [key: string]: number };
    handleBrushChange: (brushOption: number) => void;
}

const BrushPicker: React.FC<BrushPickerProps> = ({
    brushSizes,
    handleBrushChange,
}) => {
    const [selectedBrushOption, setSelectedBrushOption] = useState(1);
    const brushOptions = Array.from(
        { length: Object.keys(brushSizes).length },
        (_, i) => i + 1,
    );

    return (
        <Space style={{ display: 'flex', marginLeft: 40 }}>
            {brushOptions.map((brushOption) => (
                <div
                    key={brushOption}
                    className={
                        selectedBrushOption === brushOption
                            ? 'brush-picker-selected'
                            : 'brush-picker'
                    }
                    onClick={() => {
                        handleBrushChange(brushOption);
                        setSelectedBrushOption(brushOption);
                    }}
                >
                    <span
                        className="dot"
                        style={{
                            width: brushSizes[brushOption.toString()],
                            height: brushSizes[brushOption.toString()],
                            backgroundColor: 'black',
                            borderRadius: '50%',
                        }}
                    />
                </div>
            ))}
        </Space>
    );
};

export default BrushPicker;
