import React, { FC, useState, useEffect, useRef } from 'react';
import WhiteBoardToolBar from './whiteboard-toolbar';
import {
    imageDataToDataURL,
    dataURLToImageData,
} from '../helper-functions/image-data-and-url-conversion';
import { useSocket } from '../hooks/useSocket';

interface BrushOptions {
    color: string;
    size: number;
    shape: string;
    brush: string;
}

interface Coordinate {
    x: number;
    y: number;
}

const brushSizes: { [key: string]: number } = {
    '1': 4,
    '2': 10,
    '3': 18,
    '4': 28,
};

type WhiteBoardCanvasProps = {
    userName: string | null;
    roomId: string | undefined;
    isDrawer: boolean;
};

const WhiteBoardCanvas: FC<WhiteBoardCanvasProps> = ({
    userName,
    roomId,
    isDrawer,
}) => {
    const { socket } = useSocket();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [context, setContext] = useState<CanvasRenderingContext2D | null>(
        null,
    );
    const [gameStart, setGameStart] = useState<boolean>(false);
    const [brushOptions, setBrushOptions] = useState<BrushOptions>({
        color: '#000000',
        size: 5,
        shape: 'round',
        brush: '1',
    });
    const previousStatesRef = useRef<ImageData[]>([]);

    useEffect(() => {
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');

            if (ctx) {
                setContext(ctx);
            }
        }

        const receiveStartDrawHandler = (coords: Coordinate) => {
            if (context) {
                saveCanvasState();
                context.beginPath();
                context.moveTo(coords.x, coords.y);
            }
        };

        const receiveDrawHandler = (
            coords: Coordinate,
            color: string,
            size: number,
        ) => {
            if (context) {
                context.lineTo(coords.x, coords.y);
                context.strokeStyle = color;
                context.lineWidth = size;
                context.lineCap = 'round';
                context.stroke();
            }
        };

        const receiveStopDrawHandler = () => {
            if (context) {
                context.closePath();
            }
        };

        const receiveUndoDrawHandler = async (lastStateDataURL: string) => {
            if (context && lastStateDataURL) {
                const lastState = await dataURLToImageData(lastStateDataURL);
                context.putImageData(lastState, 0, 0);
                previousStatesRef.current = previousStatesRef.current.slice(
                    0,
                    previousStatesRef.current.length - 1,
                );
            }
        };

        const receiveClearCanvasHandler = () => {
            if (context) {
                context.clearRect(
                    0,
                    0,
                    context.canvas.width,
                    context.canvas.height,
                );
                previousStatesRef.current = [];
            }
        };

        socket.on('receiveStartDraw', receiveStartDrawHandler);
        socket.on('receiveDraw', receiveDrawHandler);
        socket.on('receiveStopDraw', receiveStopDrawHandler);
        socket.on('receiveUndoDraw', receiveUndoDrawHandler);
        socket.on('receiveClearCanvas', receiveClearCanvasHandler);

        // Cleanup the event listener
        return () => {
            socket.off('receiveStartDraw', receiveStartDrawHandler);
            socket.off('receiveDraw', receiveDrawHandler);
            socket.off('receiveStopDraw', receiveStopDrawHandler);
            socket.off('receiveUndoDraw', receiveUndoDrawHandler);
            socket.off('receiveClearCanvas', receiveClearCanvasHandler);
        };
    }, [socket, context, previousStatesRef, gameStart]); // ignore saveCanvasState() function in the dependency array

    const handleColorChange = (color: string) => {
        setBrushOptions({
            ...brushOptions,
            color: color,
        });
    };

    const handleBrushChange = (brushOption: number) => {
        const currentSize = brushSizes[brushOption];
        setBrushOptions({
            ...brushOptions,
            size: currentSize,
        });
    };

    const handleUndo = () => {
        if (context) {
            const prevStates = previousStatesRef.current;
            if (prevStates.length > 0) {
                const lastState = prevStates[prevStates.length - 1];
                context.putImageData(lastState, 0, 0);
                previousStatesRef.current = prevStates.slice(
                    0,
                    prevStates.length - 1,
                );

                const lastStateDataURL = imageDataToDataURL(lastState);
                socket.emit('undoDraw', userName, roomId, lastStateDataURL);
            }
        }
    };

    const handleClearCanvas = () => {
        if (context) {
            context.clearRect(
                0,
                0,
                context.canvas.width,
                context.canvas.height,
            );
            previousStatesRef.current = [];

            socket.emit('clearCanvas', userName, roomId);
        }
    };

    // Save the current canvas state to the previousStates array
    const saveCanvasState = () => {
        if (context) {
            const canvasState = context.getImageData(
                0,
                0,
                context.canvas.width,
                context.canvas.height,
            );
            previousStatesRef.current = [
                ...previousStatesRef.current,
                canvasState,
            ];
        }
    };

    // Get mouse coordinates relative to canvas, otherwise it will be relative to the window
    const getRelativeMouseCoords = (
        event: React.MouseEvent<HTMLCanvasElement>,
    ): Coordinate => {
        const canvasBounds = canvasRef.current!.getBoundingClientRect();
        return {
            x: event.clientX - canvasBounds.left,
            y: event.clientY - canvasBounds.top,
        };
    };

    const startDrawing = (event: React.MouseEvent<HTMLCanvasElement>) => {
        saveCanvasState();
        const coords: Coordinate = getRelativeMouseCoords(event);
        setIsDrawing(true);
        context?.beginPath();
        context?.moveTo(coords.x, coords.y);

        socket.emit('startDraw', userName, roomId, coords);
    };

    const draw = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const coords: Coordinate = getRelativeMouseCoords(event);

        context!.lineTo(coords.x, coords.y);
        context!.strokeStyle = brushOptions.color;
        context!.lineWidth = brushOptions.size;
        context!.lineCap = 'round';
        context!.stroke();

        socket.emit(
            'draw',
            userName,
            roomId,
            coords,
            brushOptions.color,
            brushOptions.size,
        );
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        context?.closePath();

        socket.emit('stopDraw', userName, roomId);
    };

    socket.on('start', (data) => {
        setGameStart(data);
        console.log(isDrawer);
        console.log(gameStart);
    });

    socket.on('stop', (data) => {
        setGameStart(data);
    });

    return (
        <div
            style={{
                width: 800,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            }}
        >
            <div>
                <canvas
                    ref={canvasRef}
                    width="800"
                    height="600"
                    style={{
                        border: '2px solid black',
                        backgroundColor: 'white',
                        borderRadius: '10px',
                    }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseOut={stopDrawing}
                />
                <WhiteBoardToolBar
                    brushSizes={brushSizes}
                    handleColorChange={handleColorChange}
                    handleBrushChange={handleBrushChange}
                    handleClearCanvas={handleClearCanvas}
                    handleUndo={handleUndo}
                />
            </div>
        </div>
    );
};

export default WhiteBoardCanvas;
