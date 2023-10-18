import React, { useState, useEffect, useRef } from 'react';
import {
    imageDataToDataURL,
    dataURLToImageData,
} from '../helper-functions/image-data-and-url-conversion';
import { useSocket } from '../hooks/useSocket';
import '../styles/components/whiteboard-canvas.css';
import WhiteBoardToolBar from './whiteboard-toolbar';

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

interface WhiteBoardCanvasProps {
    roomId: string;
    ownerName: string;
    isDrawer: boolean;
    isGameStarted: boolean;
}

const WhiteBoardCanvas = ({
    roomId,
    ownerName,
    isDrawer,
    isGameStarted,
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
            console.log('receivedraw', coords);
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
        if (!isDrawer) return;

        saveCanvasState();
        const coords: Coordinate = getRelativeMouseCoords(event);
        setIsDrawing(true);
        context?.beginPath();
        context?.moveTo(coords.x, coords.y);

        socket.emit('startDrawing', roomId, coords);
    };

    const continueDrawing = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawer) return;
        if (!isDrawing) return;

        const coords: Coordinate = getRelativeMouseCoords(event);
        console.log(coords);
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
        if (!isDrawer) return;

        setIsDrawing(false);
        context?.closePath();

        socket.emit('stopDrawing', roomId);
    };

    return (
        <div className="whiteboard-canvas-container">
            <canvas
                ref={canvasRef}
                width={798}
                height={598}
                className="whiteboard-canvas"
                onMouseDown={startDrawing}
                onMouseMove={continueDrawing}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
                style={{
                    cursor: isDrawer ? 'default' : 'not-allowed',
                }}
            />
            {!isGameStarted && (
                <div className="whiteboard-canvas-overlay">
                    Waiting for the owner {ownerName} to start the game...
                </div>
            )}
            {isDrawer && (
                <WhiteBoardToolBar
                    brushSizes={brushSizes}
                    handleColorChange={handleColorChange}
                    handleBrushChange={handleBrushChange}
                    handleClearCanvas={handleClearCanvas}
                    handleUndo={handleUndo}
                />
            )}
        </div>
    );
};

export default WhiteBoardCanvas;
