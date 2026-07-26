import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Socket } from 'socket.io-client';
import type { DrawAndGuessRoomState } from '../models/types.js';
import {
    collect,
    createRoom,
    joinRoom,
    settle,
    startTestServer,
    waitFor,
    type TestServer,
} from './helpers/test-server.js';

interface Phase {
    phaseEndsInMs: number;
}

/**
 * A room with two players in it, plus a way to find out which of them the
 * server picked to draw. The drawer is chosen at random, so no test may assume
 * it is a particular client.
 */
const seatTwoPlayers = async (harness: TestServer) => {
    const alice = await harness.connect();
    const bob = await harness.connect();

    const roomId = await createRoom(alice, {
        roomName: 'Game',
        ownerUsername: 'Alice',
        rounds: 1,
    });
    await joinRoom(alice, roomId, 'Alice');
    await joinRoom(bob, roomId, 'Bob');

    const named = new Map<Socket, string>([
        [alice, 'Alice'],
        [bob, 'Bob'],
    ]);

    /** Waits for the word-selecting phase and reports whose turn it is. */
    const awaitTurn = async () => {
        const choicesFor = new Map<Socket, string[]>();
        const onChoices = (socket: Socket) => (choices: string[]) =>
            choicesFor.set(socket, choices);
        const aliceHandler = onChoices(alice);
        const bobHandler = onChoices(bob);
        alice.on('drawerReceiveWordChoices', aliceHandler);
        bob.on('drawerReceiveWordChoices', bobHandler);

        const started = await waitFor<
            Phase & { currentDrawer: string; drawerQueue: string[] }
        >(alice, 'wordSelectingPhaseStarted');
        await settle(50);

        alice.off('drawerReceiveWordChoices', aliceHandler);
        bob.off('drawerReceiveWordChoices', bobHandler);

        const [drawer, choices] = [...choicesFor.entries()][0] ?? [];
        const guesser = drawer === alice ? bob : alice;

        return {
            started,
            drawer: drawer!,
            drawerName: named.get(drawer!)!,
            guesser,
            guesserName: named.get(guesser)!,
            choices: choices!,
            /** How many of the two clients were offered word choices. */
            offeredChoicesCount: choicesFor.size,
        };
    };

    return { alice, bob, roomId, awaitTurn };
};

describe('the game engine', () => {
    let harness: TestServer;

    beforeEach(async () => {
        harness = await startTestServer();
    });

    afterEach(async () => {
        await harness.teardown();
    });

    it('refuses to start with fewer than two players', async () => {
        const owner = await harness.connect();
        const roomId = await createRoom(owner);
        await joinRoom(owner, roomId, 'Alone');

        const error = waitFor<{ errorType: string }>(owner, 'roomError');
        owner.emit('startDrawAndGuessGame', roomId);

        expect((await error).errorType).toBe('notEnoughPlayers');
        expect(harness.server.rooms[roomId]?.isGameStarted).toBe(false);
    });

    it('refuses to start a game that is already running', async () => {
        const { alice, roomId } = await seatTwoPlayers(harness);
        alice.emit('startDrawAndGuessGame', roomId);
        await waitFor(alice, 'startDrawAndGuessGameSuccess');

        const error = waitFor<{ errorType: string }>(alice, 'roomError');
        alice.emit('startDrawAndGuessGame', roomId);

        expect((await error).errorType).toBe('gameAlreadyStarted');
    });

    it('opens with a word-selecting phase and a countdown', async () => {
        const { alice, roomId, awaitTurn } = await seatTwoPlayers(harness);
        const turn = awaitTurn();
        alice.emit('startDrawAndGuessGame', roomId);

        const { started, choices, offeredChoicesCount } = await turn;

        expect(started.phaseEndsInMs).toBeGreaterThan(0);
        expect(started.currentDrawer).toBeTruthy();
        expect(choices).toHaveLength(3);
        expect(new Set(choices).size).toBe(3);
        // The choices go to the drawer alone, not to the room.
        expect(offeredChoicesCount).toBe(1);
    });

    it('sends the word to the drawer alone, and a hint to everyone else', async () => {
        const { alice, roomId, awaitTurn } = await seatTwoPlayers(harness);
        const turn = awaitTurn();
        alice.emit('startDrawAndGuessGame', roomId);
        const { drawer, guesser, choices } = await turn;

        const guesserSaw = collect(guesser, 'drawingPhaseStarted');
        const drawerWord = waitFor<string>(drawer, 'drawingPhaseStartedForDrawer');
        const drawerPrivate = collect(guesser, 'drawingPhaseStartedForDrawer');

        drawer.emit('drawerSelectWordFinished', roomId, choices[0]);

        expect(await drawerWord).toBe(choices[0]);
        await settle();

        expect(drawerPrivate).toEqual([]);
        expect(JSON.stringify(guesserSaw)).not.toContain(choices[0]);
        expect(guesserSaw[0]).toMatchObject({
            isDrawingPhase: true,
            currentWordHint: '_'.repeat(choices[0]!.replace(/\s/g, '').length),
        });
    });

    it('ignores a word the drawer was not offered', async () => {
        const { alice, roomId, awaitTurn } = await seatTwoPlayers(harness);
        const turn = awaitTurn();
        alice.emit('startDrawAndGuessGame', roomId);
        const { drawer } = await turn;

        drawer.emit('drawerSelectWordFinished', roomId, 'not-a-choice');
        await settle(50);

        expect(harness.server.rooms[roomId]?.isDrawingPhase).toBe(false);
        expect(harness.server.rooms[roomId]?.isWordSelectingPhase).toBe(true);
    });

    it('ignores a word chosen by somebody who is not the drawer', async () => {
        const { alice, roomId, awaitTurn } = await seatTwoPlayers(harness);
        const turn = awaitTurn();
        alice.emit('startDrawAndGuessGame', roomId);
        const { guesser, choices } = await turn;

        guesser.emit('drawerSelectWordFinished', roomId, choices[0]);
        await settle();

        expect(harness.server.rooms[roomId]?.isDrawingPhase).toBe(false);
    });

    /*
     * The fallback used to be the drawer's browser's job, so it never happened
     * if they had closed the tab — the room sat in the selecting phase forever.
     */
    it('picks a word itself when the drawer never chooses one', async () => {
        const { alice, roomId, awaitTurn } = await seatTwoPlayers(harness);
        const turn = awaitTurn();
        alice.emit('startDrawAndGuessGame', roomId);
        const { drawer, choices } = await turn;

        const drawing = waitFor<Phase>(alice, 'drawingPhaseStarted');
        const word = waitFor<string>(drawer, 'drawingPhaseStartedForDrawer');

        // Nobody chooses. The server's own clock has to move the phase on.
        expect((await drawing).phaseEndsInMs).toBeGreaterThan(0);
        expect(choices).toContain(await word);
    });

    it('runs a whole turn on its own clock, ending with the word revealed', async () => {
        const { alice, roomId, awaitTurn } = await seatTwoPlayers(harness);
        const turn = awaitTurn();
        alice.emit('startDrawAndGuessGame', roomId);
        const { drawer, choices } = await turn;

        const reviewing = waitFor<Phase & { currentWord: string }>(
            alice,
            'reviewingPhaseStarted',
        );
        drawer.emit('drawerSelectWordFinished', roomId, choices[0]);

        const reveal = await reviewing;
        expect(reveal.currentWord).toBe(choices[0]);
        expect(reveal.phaseEndsInMs).toBeGreaterThan(0);

        // ...and the turn ends without any client asking it to.
        await waitFor(alice, 'reviewingPhaseEnded');
    });

    it('plays every player once per round, then ends the game', async () => {
        const { alice, roomId, awaitTurn } = await seatTwoPlayers(harness);
        const turn = awaitTurn();
        const ended = waitFor<DrawAndGuessRoomState>(
            alice,
            'endDrawAndGuessGame',
            9000,
        );
        const drawers = collect<{ currentDrawer: string }>(
            alice,
            'wordSelectingPhaseStarted',
        );

        alice.emit('startDrawAndGuessGame', roomId);
        await turn;

        const finalState = await ended;
        expect(drawers).toHaveLength(2);
        expect(new Set(drawers.map((d) => d.currentDrawer)).size).toBe(2);
        expect(finalState.isGameStarted).toBe(false);
        expect(finalState.status).toBe('Open');
        expect(harness.server.rooms[roomId]?.phaseEndsAt).toBe(0);
    });

    /*
     * The reason the clock had to move to the server at all. The drawer's tab
     * owned the phase timer, so closing it left everyone else waiting forever.
     */
    it('skips to the next turn when the drawer leaves', async () => {
        const harness3 = await startTestServer();
        try {
            const [alice, bob, carol] = await Promise.all([
                harness3.connect(),
                harness3.connect(),
                harness3.connect(),
            ]);
            const roomId = await createRoom(alice, { rounds: 1 });
            await joinRoom(alice, roomId, 'Alice');
            await joinRoom(bob, roomId, 'Bob');
            await joinRoom(carol, roomId, 'Carol');

            const clients = new Map([
                [alice.id, alice],
                [bob.id, bob],
                [carol.id, carol],
            ]);

            const firstTurn = waitFor<{ currentDrawer: string }>(
                alice,
                'wordSelectingPhaseStarted',
            );
            alice.emit('startDrawAndGuessGame', roomId);
            const { currentDrawer } = await firstTurn;

            const witness = currentDrawer === alice.id ? bob : alice;
            const turnEnded = waitFor(witness, 'reviewingPhaseEnded');
            const messages = collect<[string, string]>(witness, 'receiveMessage');

            clients.get(currentDrawer)!.close();

            await turnEnded;
            expect(
                messages.some(([, text]) => text.includes('drawer left')),
            ).toBe(true);
            expect(harness3.server.rooms[roomId]?.isGameStarted).toBe(true);
        } finally {
            await harness3.teardown();
        }
    });

    it('ends the game when too few players are left to continue', async () => {
        const { alice, bob, roomId, awaitTurn } = await seatTwoPlayers(harness);
        const turn = awaitTurn();
        alice.emit('startDrawAndGuessGame', roomId);
        await turn;

        const ended = waitFor<DrawAndGuessRoomState>(alice, 'endDrawAndGuessGame');
        bob.close();

        const finalState = await ended;
        expect(finalState.isGameStarted).toBe(false);
        expect(finalState.currentDrawer).toBe('');
        expect(harness.server.rooms[roomId]?.phaseEndsAt).toBe(0);
    });

    /*
     * A pending phase timer that fires against a deleted room used to be the
     * shape of a crash; the engine drops it with the room instead.
     */
    it('drops a pending phase timer when the room is deleted mid-turn', async () => {
        const { alice, bob, roomId, awaitTurn } = await seatTwoPlayers(harness);
        const turn = awaitTurn();
        alice.emit('startDrawAndGuessGame', roomId);
        await turn;

        alice.close();
        bob.close();
        await settle(600);

        expect(harness.server.rooms[roomId]).toBeUndefined();
    });
});
