import React, { useState, useEffect, useRef } from 'react';
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

/**
 * One continuous line, from mouse-down to mouse-up.
 *
 * The drawing is kept as a list of these rather than as canvas bitmaps. Undo
 * used to snapshot the whole canvas into an ImageData — 798 x 598 x 4 bytes,
 * about 1.9MB each, retained for the whole turn — and then ship the previous
 * state to everyone else as a PNG data URL, on the order of 100KB to 1MB per
 * undo. Every client receives the same draw events and so builds the same
 * stroke list, which makes undo a matter of dropping the last entry and
 * repainting.
 */
interface Stroke {
  color: string;
  size: number;
  points: Coordinate[];
}

const repaint = (ctx: CanvasRenderingContext2D, strokes: Stroke[]) => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (const stroke of strokes) {
    const [first, ...rest] = stroke.points;
    if (!first) continue;

    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = 'round';
    ctx.moveTo(first.x, first.y);

    if (rest.length === 0) {
      // A click without a drag is a dot; lineTo needs somewhere to go.
      ctx.lineTo(first.x + 0.01, first.y);
    } else {
      for (const point of rest) ctx.lineTo(point.x, point.y);
    }

    ctx.stroke();
    ctx.closePath();
  }
};

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
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [brushOptions, setBrushOptions] = useState<BrushOptions>({
    color: '#000000',
    size: 5,
    shape: 'round',
    brush: '1',
  });
  const [isDrawing, setIsDrawing] = useState(false);
  // The whole drawing, identical on every client in the room.
  const strokesRef = useRef<Stroke[]>([]);

  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');

      if (ctx) {
        setContext(ctx);
      }
    }

    const drawerStartDrawingHandler = (
      coords: Coordinate,
      color: string,
      size: number,
    ) => {
      if (!context) return;

      strokesRef.current.push({ color, size, points: [coords] });
      context.beginPath();
      context.strokeStyle = color;
      context.lineWidth = size;
      context.lineCap = 'round';
      context.moveTo(coords.x, coords.y);
    };

    const drawerContinueDrawingHandler = (
      coords: Coordinate,
      color: string,
      size: number,
    ) => {
      if (!context) return;

      strokesRef.current.at(-1)?.points.push(coords);
      context.lineTo(coords.x, coords.y);
      context.strokeStyle = color;
      context.lineWidth = size;
      context.lineCap = 'round';
      context.stroke();
    };

    const drawerStopDrawingHandler = () => {
      context?.closePath();
    };

    const drawerUndoHandler = () => {
      if (!context) return;

      strokesRef.current.pop();
      repaint(context, strokesRef.current);
    };

    const drawerClearHandler = () => {
      if (!context) return;

      strokesRef.current = [];
      repaint(context, strokesRef.current);
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
  }, [socket, context]);

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
    if (!context || strokesRef.current.length === 0) return;

    strokesRef.current.pop();
    repaint(context, strokesRef.current);

    // Everyone holds the same stroke list, so the instruction is enough.
    socket.emit('undo', roomId);
  };

  const handleClearCanvas = () => {
    if (!context) return;

    strokesRef.current = [];
    repaint(context, strokesRef.current);

    socket.emit('clear', roomId);
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

    const coords: Coordinate = getRelativeMouseCoords(event);
    const { color, size } = brushOptions;

    strokesRef.current.push({ color, size, points: [coords] });
    setIsDrawing(true);
    context?.beginPath();
    context?.moveTo(coords.x, coords.y);

    // Colour and size travel with the first point so that a stroke is fully
    // described from the start and can be replayed without extra events.
    socket.emit('startDrawing', roomId, coords, color, size);
  };

  const continueDrawing = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !isDrawingPhase) return;
    if (!isDrawing) return;

    const coords: Coordinate = getRelativeMouseCoords(event);
    strokesRef.current.at(-1)?.points.push(coords);

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
            <Button onClick={handleStartGame} size="large" className="startBtn">
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
                    socket.emit('drawerSelectWordFinished', roomId, word);
                  }}
                  style={{
                    fontWeight: 600,
                  }}
                >
                  {word}
                </Button>
              ))}
            </Space>
            <Typography.Title level={2}>{secondsRemaining}</Typography.Title>
          </div>
        )}
        {isGameStarted && isWordSelectingPhase && !isDrawer && (
          <div className="whiteboard-canvas-overlay">
            <Typography.Title level={3}>
              Waiting for {currentDrawer} to select a word...
            </Typography.Title>
            <Typography.Title level={2}>{secondsRemaining}</Typography.Title>
          </div>
        )}
        {isGameStarted && isReviewingPhase && (
          <div className="whiteboard-canvas-overlay">
            <Typography.Title level={3}>
              The word was: <b>{currentWord}</b>
            </Typography.Title>
            <Typography.Title level={2}>{secondsRemaining}</Typography.Title>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhiteBoardCanvas;
