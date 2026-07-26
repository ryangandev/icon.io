import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  collect,
  createRoom,
  joinRoom,
  settle,
  startTestServer,
  waitFor,
  type TestServer,
} from './helpers/test-server.js';

const RED = '#ff0000';

describe('the whiteboard relay', () => {
  let harness: TestServer;

  beforeAll(async () => {
    harness = await startTestServer();
  });

  afterAll(async () => {
    await harness.teardown();
  });

  const seatTwo = async () => {
    const drawer = await harness.connect();
    const watcher = await harness.connect();
    const roomId = await createRoom(drawer);
    await joinRoom(drawer, roomId, 'Drawer');
    await joinRoom(watcher, roomId, 'Watcher');
    return { drawer, watcher, roomId };
  };

  it('relays a stroke to the rest of the room, colour and size included', async () => {
    const { drawer, watcher, roomId } = await seatTwo();

    const started = waitFor<unknown[]>(watcher, 'drawerStartDrawing');
    drawer.emit('startDrawing', roomId, { x: 10, y: 20 }, RED, 8);
    expect(await started).toEqual([{ x: 10, y: 20 }, RED, 8]);

    const continued = waitFor<unknown[]>(watcher, 'drawerContinueDrawing');
    drawer.emit('continueDrawing', roomId, { x: 30, y: 40 }, RED, 8);
    expect(await continued).toEqual([{ x: 30, y: 40 }, RED, 8]);

    // Carries no payload — the stroke is already fully described.
    const stopped = waitFor(watcher, 'drawerStopDrawing');
    drawer.emit('stopDrawing', roomId);
    await expect(stopped).resolves.toEqual([]);
  });

  /*
   * A stroke describes itself from its first point, so a client can replay it
   * without waiting to learn the colour from a later event. That is what makes
   * the stroke list — and so a one-byte undo — possible.
   */
  it('describes a stroke fully from its first point', async () => {
    const { drawer, watcher, roomId } = await seatTwo();

    const started = waitFor<unknown[]>(watcher, 'drawerStartDrawing');
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
    const { drawer, watcher, roomId } = await seatTwo();

    const undone = collect(watcher, 'drawerUndo');
    drawer.emit('undo', roomId);
    await settle();

    expect(undone).toEqual([[]]);
  });

  it('relays a clear', async () => {
    const { drawer, watcher, roomId } = await seatTwo();

    const cleared = waitFor(watcher, 'drawerClear');
    drawer.emit('clear', roomId);
    await expect(cleared).resolves.toEqual([]);
  });

  it('does not echo a stroke back to the client that drew it', async () => {
    const { drawer, watcher, roomId } = await seatTwo();

    const echoed = collect(drawer, 'drawerStartDrawing');
    const relayed = collect(watcher, 'drawerStartDrawing');
    drawer.emit('startDrawing', roomId, { x: 5, y: 5 }, RED, 4);
    await settle();

    expect(echoed).toEqual([]);
    expect(relayed).toHaveLength(1);
  });

  it('drops a stroke that could not have come from the canvas', async () => {
    const { drawer, watcher, roomId } = await seatTwo();

    const relayed = collect(watcher, 'drawerStartDrawing');

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
    const { drawer, watcher } = await seatTwo();

    const relayed = collect(watcher, 'drawerStartDrawing');
    drawer.emit('startDrawing', '../../admin', { x: 1, y: 1 }, RED, 8);
    await settle();

    expect(relayed).toEqual([]);
  });
});
