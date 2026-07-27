import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  collect,
  createRoom,
  lobbyView,
  settle,
  startTestServer,
  waitFor,
  type DrawAndGuessLobbyRoomInfo,
  type TestServer,
} from './helpers/test-server.js';

/** `lobby:rooms` says which game it is for, then lists that game's rooms. */
type RoomsBroadcast = [string, DrawAndGuessLobbyRoomInfo[]];

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
    const list = waitFor<RoomsBroadcast>(client, 'lobby:rooms');
    client.emit('lobby:subscribe', 'draw-and-guess');

    expect(await list).toEqual(['draw-and-guess', []]);
  });

  it('announces a new room to everyone watching that lobby', async () => {
    const watcher = await harness.connect();
    const creator = await harness.connect();
    watcher.emit('lobby:subscribe', 'draw-and-guess');
    await settle();

    const broadcast = waitFor<RoomsBroadcast>(watcher, 'lobby:rooms');
    const roomId = await createRoom(creator, { roomName: 'Announced' });

    const [gameType, rooms] = await broadcast;
    expect(gameType).toBe('draw-and-guess');
    expect(rooms.map((room) => room.roomId)).toContain(roomId);
  });

  /*
   * The list used to go to every connected socket, whether or not it was
   * looking at a lobby. A lobby is a socket.io room per game now, so a client
   * that never asked is never told — which is what keeps two games' room lists
   * from waking each other's players.
   */
  it('says nothing to a client that has not subscribed', async () => {
    const bystander = await harness.connect();
    const heard = collect<RoomsBroadcast>(bystander, 'lobby:rooms');

    const creator = await harness.connect();
    await createRoom(creator, { roomName: 'Unwatched' });
    await settle();

    expect(heard).toEqual([]);
  });

  it('stops sending the list once a client unsubscribes', async () => {
    const leaver = await harness.connect();
    leaver.emit('lobby:subscribe', 'draw-and-guess');
    await settle();

    leaver.emit('lobby:unsubscribe', 'draw-and-guess');
    await settle();

    const heard = collect<RoomsBroadcast>(leaver, 'lobby:rooms');
    const creator = await harness.connect();
    await createRoom(creator, { roomName: 'After Leaving' });
    await settle();

    expect(heard).toEqual([]);
  });

  /*
   * The room list was the widest leak in the app: the password was in it
   * verbatim, readable by anyone who opened the lobby and looked at a
   * websocket frame.
   */
  it('never puts a room password on the wire', async () => {
    const eavesdropper = await harness.connect();
    const lists = collect<RoomsBroadcast>(eavesdropper, 'lobby:rooms');
    eavesdropper.emit('lobby:subscribe', 'draw-and-guess');

    const creator = await harness.connect();
    const created = collect(creator, 'room:created');
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
    const created = collect(client, 'room:created');

    client.emit('room:create', {
      gameType: 'draw-and-guess',
      roomName: 'x'.repeat(500),
      ownerUsername: 'Attacker',
      maxPlayers: 1_000_000,
      password: '',
      settings: { rounds: 999 },
    });
    client.emit('room:create', 'not an object');
    client.emit('room:create');

    await settle();

    expect(created).toEqual([]);
  });

  it('refuses a room for a game the server does not run', async () => {
    const client = await harness.connect();
    const created = collect(client, 'room:created');

    client.emit('room:create', {
      gameType: 'minesweeper',
      roomName: 'Too Early',
      ownerUsername: 'Ada',
      maxPlayers: 4,
      password: '',
      settings: {},
    });
    await settle();

    // The type is in the shared contract but no module answers to it yet.
    expect(created).toEqual([]);
  });

  /*
   * The envelope is validated by the room layer and `settings` by the game.
   * A room whose settings are refused must not be created with defaults its
   * owner never picked.
   */
  it('refuses a room whose game-specific settings do not parse', async () => {
    const client = await harness.connect();
    const created = collect(client, 'room:created');

    for (const settings of [{ rounds: 99 }, { rounds: 'two' }, {}, undefined]) {
      client.emit('room:create', {
        gameType: 'draw-and-guess',
        roomName: 'Bad Settings',
        ownerUsername: 'Ada',
        maxPlayers: 4,
        password: '',
        settings,
      });
    }
    await settle();

    expect(created).toEqual([]);
  });

  it('survives a malformed payload without dropping the connection', async () => {
    const client = await harness.connect();

    client.emit('room:create', { roomName: null });
    await settle();

    expect(client.connected).toBe(true);
    // Still serving well-formed requests afterwards.
    await expect(createRoom(client)).resolves.toEqual(expect.any(String));
  });
});
