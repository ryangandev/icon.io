import React, { useState, useEffect, useRef } from 'react';
import { imageDataToDataURL, dataURLToImageData } from '../libs/utils';
import { useSocket } from '../hooks/useSocket';
import '../styles/components/whiteboard-canvas.css';
import WhiteBoardToolBar from './whiteboard-toolbar';
import { Button, Space, Typography } from 'antd';

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

// The canvas bitmap is a fixed size that every client shares, so a stroke lands
// in the same place for everyone. How large it is *displayed* now varies with
// the window, which is why mouse positions have to be scaled into this space.
const CANVAS_WIDTH = 798;
const CANVAS_HEIGHT = 598;

const brushSizes: { [key: string]: number } = {
    '1': 4,
    '2': 10,
    '3': 18,
    '4': 28,
};

interface WhiteBoardCanvasProps {
    roomId: string;
    isDrawer: boolean;
    isGameStarted: boolean;
    isWordSelectingPhase: boolean;
    isDrawingPhase: boolean;
    isReviewingPhase: boolean;
    wordChoices: string[];
    /** Seconds left in whichever phase the server currently has running. */
    secondsRemaining: number;
    isRoomOwner: boolean;
    handleStartGame: () => void;
    currentDrawer: string;
    currentWord: string;
}

const WhiteBoardCanvas = ({
    roomId,
    isDrawer,
    isGameStarted,
    isWordSelectingPhase,
    isDrawingPhase,
    isReviewingPhase,
    wordChoices = [],
    secondsRemaining,
    isRoomOwner,
    handleStartGame,
    currentDrawer,
    currentWord,
}: WhiteBoardCanvasProps) => {
    const { socket } = useSocket();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [context, setContext] = useState<CanvasRenderingContext2D | null>(
        null,
    );
    const [brushOptions, setBrushOptions] = useState<BrushOptions>({
        color: '#000000',
        size: 5,
        shape: 'round',
        brush: '1',
    });
    const [isDrawing, setIsDrawing] = useState(false);
    const previousStatesRef = useRef<ImageData[]>([]);

    useEffect(() => {
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');

            if (ctx) {
                setContext(ctx);
            }
        }

        const drawerStartDrawingHandler = (coords: Coordinate) => {
            if (context) {
                saveCanvasState();
                context.beginPath();
                context.moveTo(coords.x, coords.y);
            }
        };

        const drawerContinueDrawingHandler = (
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

        const drawerStopDrawingHandler = () => {
            if (context) {
                context.closePath();
            }
        };

        const drawerUndoHandler = async (lastStateDataURL: string) => {
            if (context && lastStateDataURL) {
                const lastState = await dataURLToImageData(lastStateDataURL);
                context.putImageData(lastState, 0, 0);
                previousStatesRef.current = previousStatesRef.current.slice(
                    0,
                    previousStatesRef.current.length - 1,
                );
            }
        };

        const drawerClearHandler = () => {
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

        socket.on('drawerStartDrawing', drawerStartDrawingHandler);
        socket.on('drawerContinueDrawing', drawerContinueDrawingHandler);
        socket.on('drawerStopDrawing', drawerStopDrawingHandler);
        socket.on('drawerUndo', drawerUndoHandler);
        socket.on('drawerClear', drawerClearHandler);

        // Cleanup the event listener
        return () => {
            socket.off('drawerStartDrawing', drawerStartDrawingHandler);
            socket.off('drawerContinueDrawing', drawerContinueDrawingHandler);
            socket.off('drawerStopDrawing', drawerStopDrawingHandler);
            socket.off('drawerUndo', drawerUndoHandler);
            socket.off('drawerClear', drawerClearHandler);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket, context, previousStatesRef]); // ignore saveCanvasState() function in the dependency array

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
                socket.emit('undo', roomId, lastStateDataURL);
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

            socket.emit('clear', roomId);
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

    // Mouse coordinates relative to the canvas — otherwise they would be
    // relative to the window — and scaled into the canvas's own bitmap space.
    // The element is no longer always displayed at its bitmap size, and every
    // client replays these coordinates onto a canvas of its own size, so the
    // scaling is what keeps a stroke in the same place for everybody.
    const getRelativeMouseCoords = (
        event: React.MouseEvent<HTMLCanvasElement>,
    ): Coordinate => {
        const canvas = canvasRef.current!;
        const canvasBounds = canvas.getBoundingClientRect();

        return {
            x:
                ((event.clientX - canvasBounds.left) * canvas.width) /
                canvasBounds.width,
            y:
                ((event.clientY - canvasBounds.top) * canvas.height) /
                canvasBounds.height,
        };
    };

    const startDrawing = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawer || !isDrawingPhase) return;

        saveCanvasState();
        const coords: Coordinate = getRelativeMouseCoords(event);
        setIsDrawing(true);
        context?.beginPath();
        context?.moveTo(coords.x, coords.y);

        socket.emit('startDrawing', roomId, coords);
    };

    const continueDrawing = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawer || !isDrawingPhase) return;
        if (!isDrawing) return;

        const coords: Coordinate = getRelativeMouseCoords(event);
        context!.lineTo(coords.x, coords.y);
        context!.strokeStyle = brushOptions.color;
        context!.lineWidth = brushOptions.size;
        context!.lineCap = 'round';
        context!.stroke();

        socket.emit(
            'continueDrawing',
            roomId,
            coords,
            brushOptions.color,
            brushOptions.size,
        );
    };

    const stopDrawing = () => {
        if (!isDrawer || !isDrawingPhase) return;

        setIsDrawing(false);
        context?.closePath();

        socket.emit('stopDrawing', roomId);
    };

    return (
        <div className="whiteboard-canvas-container">
            {/* The toolbar sits above the canvas: below it, at 720p, it landed
                past the bottom of the window and the drawer had to scroll to
                reach their own colours and brushes. */}
            {isGameStarted && isDrawer && (
                <WhiteBoardToolBar
                    brushSizes={brushSizes}
                    handleColorChange={handleColorChange}
                    handleBrushChange={handleBrushChange}
                    handleClearCanvas={handleClearCanvas}
                    handleUndo={handleUndo}
                />
            )}
            <div className="whiteboard-canvas-stage">
                <canvas
                    ref={canvasRef}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    className="whiteboard-canvas"
                    onMouseDown={startDrawing}
                    onMouseMove={continueDrawing}
                    onMouseUp={stopDrawing}
                    onMouseOut={stopDrawing}
                    style={{
                        cursor: isDrawer ? 'default' : 'not-allowed',
                    }}
                />
                {!isGameStarted && !isRoomOwner && (
                    <div className="whiteboard-canvas-overlay">
                        Waiting for the owner to start the game...
                    </div>
                )}
                {!isGameStarted && isRoomOwner && (
                    <div className="whiteboard-canvas-overlay">
                        Waiting for other players to join...
                        <Button
                            onClick={handleStartGame}
                            size="large"
                            className="startBtn"
                        >
                            START
                        </Button>
                    </div>
                )}
                {isGameStarted && isWordSelectingPhase && isDrawer && (
                    <div className="whiteboard-canvas-overlay">
                        <Typography.Title level={3}>
                            Select a word to draw:
                        </Typography.Title>
                        <Space direction="horizontal">
                            {wordChoices.map((word, index) => (
                                <Button
                                    key={index}
                                    size="large"
                                    onClick={() => {
                                        socket.emit(
                                            'drawerSelectWordFinished',
                                            roomId,
                                            word,
                                        );
                                    }}
                                    style={{
                                        fontWeight: 600,
                                    }}
                                >
                                    {word}
                                </Button>
                            ))}
                        </Space>
                        <Typography.Title level={2}>
                            {secondsRemaining}
                        </Typography.Title>
                    </div>
                )}
                {isGameStarted && isWordSelectingPhase && !isDrawer && (
                    <div className="whiteboard-canvas-overlay">
                        <Typography.Title level={3}>
                            Waiting for {currentDrawer} to select a word...
                        </Typography.Title>
                        <Typography.Title level={2}>
                            {secondsRemaining}
                        </Typography.Title>
                    </div>
                )}
                {isGameStarted && isReviewingPhase && (
                    <div className="whiteboard-canvas-overlay">
                        <Typography.Title level={3}>
                            The word was: <b>{currentWord}</b>
                        </Typography.Title>
                        <Typography.Title level={2}>
                            {secondsRemaining}
                        </Typography.Title>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WhiteBoardCanvas;
