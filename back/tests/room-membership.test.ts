import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DrawAndGuessRoomState } from '../models/types.js';
import {
  collect,
  createRoom,
  joinRoom,
  lobbyView,
  settle,
  startTestServer,
  waitFor,
  waitUntil,
  type TestServer,
} from './helpers/test-server.js';

describe('joining and leaving a room', () => {
  let harness: TestServer;

  beforeAll(async () => {
    harness = await startTestServer();
  });

  afterAll(async () => {
    await harness.teardown();
  });

  it('admits a player and tells the room who is in it', async () => {
    const owner = await harness.connect();
    const roomId = await createRoom(owner, { ownerUsername: 'Ada' });
    await joinRoom(owner, roomId, 'Ada');

    const guest = await harness.connect();
    // The owner's own join snapshot may still be in flight, and it now shares
    // an event name with this one.
    const roomUpdate = waitUntil<DrawAndGuessRoomState>(
      owner,
      'room:state',
      (state) => state.currentPlayerCount === 2,
    );
    await joinRoom(guest, roomId, 'Grace');

    const state = await roomUpdate;
    expect(state.currentPlayerCount).toBe(2);
    expect(
      Object.values(state.playerList).map((player) => player.username),
    ).toEqual(expect.arrayContaining(['Ada', 'Grace']));
  });

  it('refuses the wrong password and admits the right one', async () => {
    const owner = await harness.connect();
    const roomId = await createRoom(owner, { password: 'open-sesame' });

    const guest = await harness.connect();
    const rejection = waitFor<{ message: string }>(guest, 'room:join:denied');
    guest.emit('room:join', roomId, 'Guest', 'wrong');
    expect((await rejection).message).toMatch(/password/i);

    await expect(
      joinRoom(guest, roomId, 'Guest', 'open-sesame'),
    ).resolves.toBeUndefined();
  });

  it('reports a room that does not exist rather than inventing one', async () => {
    const client = await harness.connect();
    const error = waitFor<{ errorType: string }>(client, 'room:error');
    client.emit('room:join', randomUUID(), 'Nobody', '');

    expect((await error).errorType).toBe('roomNotExist');
  });

  it('marks a room full at capacity and turns further joins away', async () => {
    const owner = await harness.connect();
    const roomId = await createRoom(owner, { maxPlayers: 2 });
    await joinRoom(owner, roomId, 'One');

    const second = await harness.connect();
    await joinRoom(second, roomId, 'Two');

    expect((await lobbyView(owner, roomId))?.status).toBe('Full');

    const third = await harness.connect();
    const error = waitFor<{ errorType: string }>(third, 'room:error');
    third.emit('room:join', roomId, 'Three', '');

    expect((await error).errorType).toBe('roomNotOpen');
  });

  /*
   * The join broadcast races the joining client's own navigation — it cannot
   * have subscribed yet. This used to be papered over with a 250ms delay on
   * the server; the room page now says when it is ready instead.
   */
  it('replays the room state on request, for a client that has just mounted', async () => {
    const owner = await harness.connect();
    const roomId = await createRoom(owner, { ownerUsername: 'Ada' });
    await joinRoom(owner, roomId, 'Ada');

    // A client that subscribes only *after* joining still gets the state.
    const latecomer = await harness.connect();
    latecomer.emit('room:join', roomId, 'Late', '');
    await waitFor(latecomer, 'room:joined');
    await settle();

    const state = waitFor<DrawAndGuessRoomState>(latecomer, 'room:state');
    latecomer.emit('room:sync', roomId);

    expect((await state).currentPlayerCount).toBe(2);
  });

  /*
   * A client that arrives at a room without a seat — a pasted link, say — is
   * told so rather than handed the room's state. The payload holds no secrets,
   * but a locked room's player list is not something a stranger should be able
   * to pull with a room id off the lobby broadcast, and every id in that
   * broadcast is public.
   */
  it('refuses the room state to a client that holds no seat', async () => {
    const holder = await harness.connect();
    const roomId = await createRoom(holder, { ownerUsername: 'Holder' });
    await joinRoom(holder, roomId, 'Holder');

    const arriving = await harness.connect();
    const leaked = collect(arriving, 'room:state');
    const error = waitFor<{ errorType: string }>(arriving, 'room:error');
    arriving.emit('room:sync', roomId);

    expect((await error).errorType).toBe('notRoomMember');
    await settle();
    expect(leaked).toEqual([]);
  });

  /*
   * ...and that refusal is the room page's cue to ask for a seat, which is how
   * a pasted link still gets you into an open room.
   */
  it('lets a refused client join, and then see the state', async () => {
    const holder = await harness.connect();
    const roomId = await createRoom(holder, { ownerUsername: 'Holder' });
    await joinRoom(holder, roomId, 'Holder');

    const arriving = await harness.connect();
    await joinRoom(arriving, roomId, 'Arrived');
    await settle();

    const snapshot = waitFor<DrawAndGuessRoomState>(arriving, 'room:state');
    arriving.emit('room:sync', roomId);

    const state = await snapshot;
    expect(state.playerList[arriving.playerId]?.username).toBe('Arrived');
    expect(state.currentPlayerCount).toBe(2);
  });

  it('reports a state request for a room that has gone away', async () => {
    const client = await harness.connect();
    const error = waitFor<{ errorType: string }>(client, 'room:error');
    client.emit('room:sync', randomUUID());

    expect((await error).errorType).toBe('roomNotExist');
  });

  it('hands ownership to the next player when the owner leaves', async () => {
    const owner = await harness.connect();
    const roomId = await createRoom(owner, { ownerUsername: 'Ada' });
    await joinRoom(owner, roomId, 'Ada');

    const guest = await harness.connect();
    await joinRoom(guest, roomId, 'Grace');

    // The snapshot that no longer seats Ada, rather than whichever one arrives
    // next: joining and leaving both broadcast `room:state`, so Grace's own
    // join snapshot — in which Ada is still the owner — can still be in flight.
    const departure = waitUntil<DrawAndGuessRoomState>(
      guest,
      'room:state',
      (state) => !state.playerList[owner.playerId],
    );
    owner.emit('room:leave', roomId, 'Ada');

    expect((await departure).owner.username).toBe('Grace');
  });

  it('deletes a room once the last player leaves', async () => {
    const owner = await harness.connect();
    const roomId = await createRoom(owner);
    await joinRoom(owner, roomId, 'Only');

    owner.emit('room:leave', roomId, 'Only');
    await settle();

    expect(harness.server.rooms[roomId]).toBeUndefined();
  });

  it('holds the room briefly when its last player drops, then cleans up', async () => {
    const owner = await harness.connect();
    const roomId = await createRoom(owner);
    await joinRoom(owner, roomId, 'Only');

    owner.close();
    await settle(200);

    // Still there: a dropped connection might be a reload, and deleting the
    // room immediately is what used to make refreshing into one impossible.
    expect(harness.server.rooms[roomId]).toBeDefined();
    expect(
      harness.server.rooms[roomId]?.playerList[owner.playerId]?.isConnected,
    ).toBe(false);

    await settle(700);

    expect(harness.server.rooms[roomId]).toBeUndefined();
  });

  /*
   * Leaving a room you were never in used to run the entire departure anyway:
   * the player count was recomputed, ownership could be handed on, and the
   * room was told somebody had left. It then threw on `socketInRooms[id]`
   * being undefined — after the damage was already done.
   */
  describe('a leave from a socket that is not in the room', () => {
    it('changes nothing and reports no error', async () => {
      const owner = await harness.connect();
      const roomId = await createRoom(owner, { ownerUsername: 'Ada' });
      await joinRoom(owner, roomId, 'Ada');

      const guest = await harness.connect();
      await joinRoom(guest, roomId, 'Grace');

      const errors = collect(owner, 'room:error');
      const messages = collect<[string, string]>(owner, 'chat:message');

      const stranger = await harness.connect();
      const strangerErrors = collect(stranger, 'room:error');
      stranger.emit('room:leave', roomId, 'Stranger');
      await settle();

      expect(harness.server.rooms[roomId]?.currentPlayerCount).toBe(2);
      expect(harness.server.rooms[roomId]?.owner.username).toBe('Ada');
      expect(messages.filter(([, text]) => text.includes('has left'))).toEqual(
        [],
      );
      expect(errors).toEqual([]);
      expect(strangerErrors).toEqual([]);
    });

    it('removes exactly one player when the same client leaves twice', async () => {
      const owner = await harness.connect();
      const roomId = await createRoom(owner);
      await joinRoom(owner, roomId, 'Ada');

      const guest = await harness.connect();
      await joinRoom(guest, roomId, 'Grace');

      guest.emit('room:leave', roomId, 'Grace');
      await settle();
      guest.emit('room:leave', roomId, 'Grace');
      await settle();

      expect(harness.server.rooms[roomId]?.currentPlayerCount).toBe(1);
    });
  });
});
