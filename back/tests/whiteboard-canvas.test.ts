import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Socket } from 'socket.io-client';
import {
  collect,
  createRoom,
  joinRoom,
  playToDrawingPhase,
  settle,
  startTestServer,
  waitFor,
  type TestServer,
} from './helpers/test-server.js';

const RED = '#ff0000';
const DOT = { x: 10, y: 20 };

describe('the whiteboard relay', () => {
  let harness: TestServer;

  beforeEach(async () => {
    // A drawing phase long enough to make every assertion inside one.
    harness = await startTestServer({
      wordSelecting: 0.2,
      drawing: 5,
      reviewing: 0.2,
    });
  });

  afterEach(async () => {
    await harness.teardown();
  });

  it('relays a stroke to the rest of the room, colour and size included', async () => {
    const { drawer, guesser, roomId } = await playToDrawingPhase(harness);

    const started = waitFor<unknown[]>(guesser, 'drawerStartDrawing');
    drawer.emit('startDrawing', roomId, DOT, RED, 8);
    expect(await started).toEqual([DOT, RED, 8]);

    const continued = waitFor<unknown[]>(guesser, 'drawerContinueDrawing');
    drawer.emit('continueDrawing', roomId, { x: 30, y: 40 }, RED, 8);
    expect(await continued).toEqual([{ x: 30, y: 40 }, RED, 8]);

    // Carries no payload — the stroke is already fully described.
    const stopped = waitFor(guesser, 'drawerStopDrawing');
    drawer.emit('stopDrawing', roomId);
    await expect(stopped).resolves.toEqual([]);
  });

  /*
   * A stroke describes itself from its first point, so a client can replay it
   * without waiting to learn the colour from a later event. That is what makes
   * the stroke list — and so a one-byte undo — possible.
   */
  it('describes a stroke fully from its first point', async () => {
    const { drawer, guesser, roomId } = await playToDrawingPhase(harness);

    const started = waitFor<unknown[]>(guesser, 'drawerStartDrawing');
    drawer.emit('startDrawing', roomId, { x: 1, y: 1 }, '#00ff00', 24);

    const [, color, size] = await started;
    expect(color).toBe('#00ff00');
    expect(size).toBe(24);
  });

  /*
   * Undo used to carry a full-canvas PNG data URL — on the order of 100KB to
   * 1MB, per undo. Every client holds the same stroke list, so "drop the last
   * one" is the entire message.
   */
  it('sends an undo with no payload at all', async () => {
    const { drawer, guesser, roomId } = await playToDrawingPhase(harness);

    const undone = collect(guesser, 'drawerUndo');
    drawer.emit('undo', roomId);
    await settle();

    expect(undone).toEqual([[]]);
  });

  it('relays a clear', async () => {
    const { drawer, guesser, roomId } = await playToDrawingPhase(harness);

    const cleared = waitFor(guesser, 'drawerClear');
    drawer.emit('clear', roomId);
    await expect(cleared).resolves.toEqual([]);
  });

  it('does not echo a stroke back to the client that drew it', async () => {
    const { drawer, guesser, roomId } = await playToDrawingPhase(harness);

    const echoed = collect(drawer, 'drawerStartDrawing');
    const relayed = collect(guesser, 'drawerStartDrawing');
    drawer.emit('startDrawing', roomId, { x: 5, y: 5 }, RED, 4);
    await settle();

    expect(echoed).toEqual([]);
    expect(relayed).toHaveLength(1);
  });

  it('drops a stroke that could not have come from the canvas', async () => {
    const { drawer, guesser, roomId } = await playToDrawingPhase(harness);

    const relayed = collect(guesser, 'drawerStartDrawing');

    drawer.emit('startDrawing', roomId, { x: 1e9, y: 1e9 }, RED, 8);
    drawer.emit('startDrawing', roomId, { x: 1, y: 1 }, 'red', 8);
    drawer.emit('startDrawing', roomId, { x: 1, y: 1 }, RED, 1e6);
    drawer.emit('startDrawing', roomId, { x: 1, y: 1 }, RED);
    drawer.emit('startDrawing', roomId);
    await settle();

    expect(relayed).toEqual([]);
    expect(drawer.connected).toBe(true);
  });

  it('drops a stroke aimed at something that is not a room id', async () => {
    const { drawer, guesser } = await playToDrawingPhase(harness);

    const relayed = collect(guesser, 'drawerStartDrawing');
    drawer.emit('startDrawing', '../../admin', { x: 1, y: 1 }, RED, 8);
    await settle();

    expect(relayed).toEqual([]);
  });
});

/*
 * The relay used to check the *shape* of a payload and nothing else — not that
 * the sender was in the room, not that they were the drawer, not that a drawing
 * phase was even running. Room ids are not secret: the lobby list is broadcast
 * to every connected client and carries the id of every room, locked ones
 * included. A client that had never joined could therefore draw on a stranger's
 * canvas, undo their last stroke, or wipe the whole thing mid-turn — and `clear`
 * costs the attacker exactly one emit.
 */
describe('canvas authority', () => {
  let harness: TestServer;

  beforeEach(async () => {
    harness = await startTestServer({
      wordSelecting: 0.2,
      drawing: 5,
      reviewing: 0.2,
    });
  });

  afterEach(async () => {
    await harness.teardown();
  });

  const everyCanvasEvent = [
    'drawerStartDrawing',
    'drawerContinueDrawing',
    'drawerStopDrawing',
    'drawerUndo',
    'drawerClear',
  ];

  /** Fires all five canvas events at a room and reports what got through. */
  const stormTheCanvas = async (
    client: Socket,
    witness: Socket,
    roomId: string,
  ) => {
    const seen = everyCanvasEvent.map((event) => collect(witness, event));

    client.emit('startDrawing', roomId, DOT, RED, 8);
    client.emit('continueDrawing', roomId, { x: 11, y: 21 }, RED, 8);
    client.emit('stopDrawing', roomId);
    client.emit('undo', roomId);
    client.emit('clear', roomId);
    await settle();

    return seen.flat();
  };

  it('ignores every canvas event from a client that never joined the room', async () => {
    const { drawer, roomId } = await playToDrawingPhase(harness);
    const outsider = await harness.connect();

    expect(await stormTheCanvas(outsider, drawer, roomId)).toEqual([]);
  });

  it('ignores canvas events from a player who is in the room but not drawing', async () => {
    const { guesser, drawer, roomId } = await playToDrawingPhase(harness);

    expect(await stormTheCanvas(guesser, drawer, roomId)).toEqual([]);
  });

  it('ignores canvas events from the drawer once their turn is over', async () => {
    const { drawer, guesser, roomId } = await playToDrawingPhase(harness);

    // The reveal is not a drawing phase, and neither is anything after it.
    await waitFor(drawer, 'reviewingPhaseStarted', 9000);

    expect(await stormTheCanvas(drawer, guesser, roomId)).toEqual([]);
  });

  it('ignores canvas events before any game has started', async () => {
    const owner = await harness.connect();
    const guest = await harness.connect();
    const roomId = await createRoom(owner, { ownerUsername: 'Owner' });
    await joinRoom(owner, roomId, 'Owner');
    await joinRoom(guest, roomId, 'Guest');

    expect(await stormTheCanvas(owner, guest, roomId)).toEqual([]);
  });
});
