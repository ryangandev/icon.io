import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { LobbyRoomInfo } from '../models/types.js';
import {
  collect,
  createRoom,
  lobbyView,
  settle,
  startTestServer,
  waitFor,
  type TestServer,
} from './helpers/test-server.js';

describe('the lobby', () => {
  let harness: TestServer;

  beforeAll(async () => {
    harness = await startTestServer();
  });

  afterAll(async () => {
    await harness.teardown();
  });

  it('starts empty', async () => {
    const client = await harness.connect();
    const list = waitFor<LobbyRoomInfo[]>(
      client,
      'updateDrawAndGuessLobbyRoomList',
    );
    client.emit('clientJoinDrawAndGuessLobby');

    expect(await list).toEqual([]);
  });

  it('announces a new room to everyone already in the lobby', async () => {
    const watcher = await harness.connect();
    const creator = await harness.connect();

    const broadcast = waitFor<LobbyRoomInfo[]>(
      watcher,
      'updateDrawAndGuessLobbyRoomList',
    );
    const roomId = await createRoom(creator, { roomName: 'Announced' });

    expect((await broadcast).map((room) => room.roomId)).toContain(roomId);
  });

  /*
   * The room list is broadcast to every connected socket, so it was the
   * widest leak in the app: the password was in it verbatim, readable by
   * anyone who opened the lobby and looked at a websocket frame.
   */
  it('never puts a room password on the wire', async () => {
    const eavesdropper = await harness.connect();
    const lists = collect<LobbyRoomInfo[]>(
      eavesdropper,
      'updateDrawAndGuessLobbyRoomList',
    );
    eavesdropper.emit('clientJoinDrawAndGuessLobby');

    const creator = await harness.connect();
    const created = collect(creator, 'createDrawAndGuessRoomSuccess');
    const roomId = await createRoom(creator, {
      roomName: 'Locked',
      password: 'super-secret',
    });

    await settle();

    expect(JSON.stringify(lists)).not.toContain('super-secret');
    // Not echoed back to the creator either — they already have it.
    expect(JSON.stringify(created)).not.toContain('super-secret');

    const room = await lobbyView(eavesdropper, roomId);
    expect(room?.hasPassword).toBe(true);
    expect(room).not.toHaveProperty('password');
  });

  it('marks an unlocked room as having no password', async () => {
    const client = await harness.connect();
    const roomId = await createRoom(client, { roomName: 'Open House' });

    expect((await lobbyView(client, roomId))?.hasPassword).toBe(false);
  });

  it('creates a room with nobody in it, owned by its creator', async () => {
    const client = await harness.connect();
    const roomId = await createRoom(client, {
      roomName: 'Empty',
      ownerUsername: 'Ada',
      maxPlayers: 6,
      rounds: 3,
    });

    const room = await lobbyView(client, roomId);
    expect(room).toMatchObject({
      roomName: 'Empty',
      currentPlayerCount: 0,
      maxPlayers: 6,
      rounds: 3,
      status: 'Open',
    });
    expect(room?.owner.username).toBe('Ada');
  });

  it('drops a create request the UI could not have sent', async () => {
    const client = await harness.connect();
    const created = collect(client, 'createDrawAndGuessRoomSuccess');

    client.emit('createDrawAndGuessRoomRequest', {
      roomName: 'x'.repeat(500),
      ownerUsername: 'Attacker',
      maxPlayers: 1_000_000,
      rounds: 999,
      password: '',
    });
    client.emit('createDrawAndGuessRoomRequest', 'not an object');
    client.emit('createDrawAndGuessRoomRequest');

    await settle();

    expect(created).toEqual([]);
  });

  it('survives a malformed payload without dropping the connection', async () => {
    const client = await harness.connect();

    client.emit('createDrawAndGuessRoomRequest', { roomName: null });
    await settle();

    expect(client.connected).toBe(true);
    // Still serving well-formed requests afterwards.
    await expect(createRoom(client)).resolves.toEqual(expect.any(String));
  });
});
