import type { CanvasStroke, Coordinate } from '../../../shared/wire-types';

/**
 * What changed, so a canvas can draw just the new segment of a stroke rather
 * than repaint everything on every pointer move.
 */
export type CanvasChange =
  { type: 'reset' } | { type: 'extend'; stroke: CanvasStroke; from: number };

type Listener = (change: CanvasChange) => void;

/**
 * The shared drawing of a Draw & Guess room: the strokes so far, kept outside
 * React because a stroke grows dozens of times a second.
 *
 * The server streams other players' strokes and never echoes the drawer's own,
 * so the drawer's input is applied here directly as well as sent.
 */
export class CanvasStream {
  private strokes: CanvasStroke[] = [];
  private open = false;
  private readonly listeners = new Set<Listener>();

  snapshot(): readonly CanvasStroke[] {
    return this.strokes;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  sync(strokes: CanvasStroke[]): void {
    this.strokes = strokes.map((stroke) => ({
      ...stroke,
      points: [...stroke.points],
    }));
    this.open = false;
    this.emit({ type: 'reset' });
  }

  start(point: Coordinate, color: string, size: number): void {
    const stroke = { color, size, points: [point] };
    this.strokes.push(stroke);
    this.open = true;
    this.emit({ type: 'extend', stroke, from: 0 });
  }

  move(point: Coordinate, color: string, size: number): void {
    // A move without a start (joined mid-stroke) begins a stroke of its own.
    if (!this.open) {
      this.start(point, color, size);
      return;
    }
    const stroke = this.strokes[this.strokes.length - 1];
    stroke.points.push(point);
    this.emit({ type: 'extend', stroke, from: stroke.points.length - 2 });
  }

  end(): void {
    this.open = false;
  }

  undo(): void {
    this.strokes.pop();
    this.open = false;
    this.emit({ type: 'reset' });
  }

  clear(): void {
    this.sync([]);
  }

  private emit(change: CanvasChange): void {
    for (const listener of this.listeners) listener(change);
  }
}
