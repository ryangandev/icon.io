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
        const roomUpdate = waitFor<DrawAndGuessRoomState>(
            owner,
            'clientJoinDrawAndGuessRoomSuccess',
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
        const rejection = waitFor<{ message: string }>(
            guest,
            'rejectClientJoinDrawAndGuessRoomRequest',
        );
        guest.emit('clientJoinDrawAndGuessRoomRequest', roomId, 'Guest', 'wrong');
        expect((await rejection).message).toMatch(/password/i);

        await expect(
            joinRoom(guest, roomId, 'Guest', 'open-sesame'),
        ).resolves.toBeUndefined();
    });

    it('reports a room that does not exist rather than inventing one', async () => {
        const client = await harness.connect();
        const error = waitFor<{ errorType: string }>(client, 'roomError');
        client.emit(
            'clientJoinDrawAndGuessRoomRequest',
            randomUUID(),
            'Nobody',
            '',
        );

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
        const error = waitFor<{ errorType: string }>(third, 'roomError');
        third.emit('clientJoinDrawAndGuessRoomRequest', roomId, 'Three', '');

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
        latecomer.emit('clientJoinDrawAndGuessRoomRequest', roomId, 'Late', '');
        await waitFor(latecomer, 'approveClientJoinDrawAndGuessRoomRequest');
        await settle();

        const state = waitFor<DrawAndGuessRoomState>(
            latecomer,
            'clientJoinDrawAndGuessRoomSuccess',
        );
        latecomer.emit('requestDrawAndGuessRoomState', roomId);

        expect((await state).currentPlayerCount).toBe(2);
    });

    /*
     * What a refresh does. The reloaded page arrives with a brand-new socket
     * that has never joined, so the snapshot it asks for does not list it —
     * that absence is the signal to rejoin, rather than sit in the room as a
     * spectator who cannot chat, guess or be dealt a turn.
     */
    it('lets a reloaded client see it is absent, then rejoin', async () => {
        const holder = await harness.connect();
        const roomId = await createRoom(holder, { ownerUsername: 'Holder' });
        await joinRoom(holder, roomId, 'Holder');

        const reloaded = await harness.connect();
        const snapshot = waitFor<DrawAndGuessRoomState>(
            reloaded,
            'clientJoinDrawAndGuessRoomSuccess',
        );
        reloaded.emit('requestDrawAndGuessRoomState', roomId);

        const before = await snapshot;
        expect(before.playerList[reloaded.id!]).toBeUndefined();
        expect(before.currentPlayerCount).toBe(1);

        await joinRoom(reloaded, roomId, 'Refreshed');
        await settle();

        const room = harness.server.rooms[roomId];
        expect(room?.playerList[reloaded.id!]?.username).toBe('Refreshed');
        expect(room?.currentPlayerCount).toBe(2);
    });

    it('reports a state request for a room that has gone away', async () => {
        const client = await harness.connect();
        const error = waitFor<{ errorType: string }>(client, 'roomError');
        client.emit('requestDrawAndGuessRoomState', randomUUID());

        expect((await error).errorType).toBe('roomNotExist');
    });

    it('hands ownership to the next player when the owner leaves', async () => {
        const owner = await harness.connect();
        const roomId = await createRoom(owner, { ownerUsername: 'Ada' });
        await joinRoom(owner, roomId, 'Ada');

        const guest = await harness.connect();
        await joinRoom(guest, roomId, 'Grace');

        const departure = waitFor<DrawAndGuessRoomState>(
            guest,
            'clientLeaveDrawAndGuessRoomSuccess',
        );
        owner.emit('clientLeaveDrawAndGuessRoom', roomId, 'Ada');

        expect((await departure).owner.username).toBe('Grace');
    });

    it('deletes a room once the last player leaves', async () => {
        const owner = await harness.connect();
        const roomId = await createRoom(owner);
        await joinRoom(owner, roomId, 'Only');

        owner.emit('clientLeaveDrawAndGuessRoom', roomId, 'Only');
        await settle();

        expect(harness.server.rooms[roomId]).toBeUndefined();
    });

    it('cleans up a room when its last player drops the connection', async () => {
        const owner = await harness.connect();
        const roomId = await createRoom(owner);
        await joinRoom(owner, roomId, 'Only');

        owner.close();
        await settle(300);

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

            const errors = collect(owner, 'roomError');
            const messages = collect<[string, string]>(owner, 'receiveMessage');

            const stranger = await harness.connect();
            const strangerErrors = collect(stranger, 'roomError');
            stranger.emit('clientLeaveDrawAndGuessRoom', roomId, 'Stranger');
            await settle();

            expect(harness.server.rooms[roomId]?.currentPlayerCount).toBe(2);
            expect(harness.server.rooms[roomId]?.owner.username).toBe('Ada');
            expect(
                messages.filter(([, text]) => text.includes('has left')),
            ).toEqual([]);
            expect(errors).toEqual([]);
            expect(strangerErrors).toEqual([]);
        });

        it('removes exactly one player when the same client leaves twice', async () => {
            const owner = await harness.connect();
            const roomId = await createRoom(owner);
            await joinRoom(owner, roomId, 'Ada');

            const guest = await harness.connect();
            await joinRoom(guest, roomId, 'Grace');

            guest.emit('clientLeaveDrawAndGuessRoom', roomId, 'Grace');
            await settle();
            guest.emit('clientLeaveDrawAndGuessRoom', roomId, 'Grace');
            await settle();

            expect(harness.server.rooms[roomId]?.currentPlayerCount).toBe(1);
        });
    });
});
