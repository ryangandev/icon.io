import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import DrawAndGuessLobby from './draw-and-guess-lobby';
import type { RoomInfo } from '../../models/types';
import { createFakeSocket } from '../../tests/fake-socket';
import { renderWithSocket } from '../../tests/render';

const makeRoom = (overrides: Partial<RoomInfo> = {}): RoomInfo => ({
    roomId: 'room-open',
    roomName: 'Open Room',
    owner: { username: 'Ada', socketId: 'socket-ada' },
    status: 'Open',
    currentPlayerCount: 1,
    maxPlayers: 4,
    rounds: 2,
    hasPassword: false,
    ...overrides,
});

const ROOMS: RoomInfo[] = [
    makeRoom(),
    makeRoom({
        roomId: 'room-locked-a',
        roomName: 'Locked Alpha',
        hasPassword: true,
    }),
    makeRoom({
        roomId: 'room-locked-b',
        roomName: 'Locked Beta',
        hasPassword: true,
    }),
];

const renderLobby = () => {
    const socket = createFakeSocket();
    const view = renderWithSocket(<DrawAndGuessLobby />, { socket });

    act(() => {
        socket.serverEmits('updateDrawAndGuessLobbyRoomList', ROOMS);
    });

    return { ...view, socket };
};

const joinButtonFor = (roomName: string) =>
    within(screen.getByRole('row', { name: new RegExp(roomName) })).getByRole(
        'button',
        { name: 'Join' },
    );

describe('the Draw & Guess lobby', () => {
    beforeEach(() => {
        sessionStorage.setItem('username', 'Tester');
    });

    it('asks the server for the room list on mount', () => {
        const { socket } = renderLobby();

        expect(socket.sentArgs('clientJoinDrawAndGuessLobby')).toHaveLength(1);
    });

    it('lists every room the server sent', () => {
        renderLobby();

        for (const room of ROOMS) {
            expect(screen.getByText(room.roomName)).toBeInTheDocument();
        }
        expect(screen.getByText('Total Rooms: 3')).toBeInTheDocument();
    });

    it('joins an unlocked room straight away, with no prompt', async () => {
        const user = userEvent.setup();
        const { socket } = renderLobby();

        await user.click(joinButtonFor('Open Room'));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(
            socket.sentArgs('clientJoinDrawAndGuessRoomRequest'),
        ).toEqual([['room-open', 'Tester']]);
    });

    /*
     * The prompt used to be rendered inside the table's Action column, so there
     * was one modal per locked room and a single `showPasswordPrompt` boolean
     * driving all of them. Clicking Join opened every locked room's modal at
     * once, stacked, and whichever landed on top decided which room you joined.
     */
    it('opens exactly one password prompt, for the room that was clicked', async () => {
        const user = userEvent.setup();
        renderLobby();

        await user.click(joinButtonFor('Locked Alpha'));

        const dialogs = await screen.findAllByRole('dialog');
        expect(dialogs).toHaveLength(1);
        expect(
            within(dialogs[0]).getByText('Password for "Locked Alpha"'),
        ).toBeInTheDocument();
        expect(screen.queryByText(/Locked Beta"/)).not.toBeInTheDocument();
    });

    it('sends the password to the room that was actually clicked', async () => {
        const user = userEvent.setup();
        const { socket } = renderLobby();

        await user.click(joinButtonFor('Locked Beta'));

        const dialog = await screen.findByRole('dialog');
        await user.type(within(dialog).getByPlaceholderText('Password'), 'hunter2');
        await user.click(within(dialog).getByRole('button', { name: 'Join' }));

        expect(socket.sentArgs('clientJoinDrawAndGuessRoomRequest')).toEqual([
            ['room-locked-b', 'Tester', 'hunter2'],
        ]);
    });

    it('starts each prompt with an empty field, not the last one typed', async () => {
        const user = userEvent.setup();
        renderLobby();

        await user.click(joinButtonFor('Locked Alpha'));
        await user.type(await screen.findByPlaceholderText('Password'), 'first');
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        await waitFor(() =>
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
        );

        await user.click(joinButtonFor('Locked Beta'));

        const field = await screen.findByPlaceholderText('Password');
        expect(field).toHaveValue('');
        expect(
            screen.getByText('Password for "Locked Beta"'),
        ).toBeInTheDocument();
    });

    it('never asks the server for a room password', async () => {
        const user = userEvent.setup();
        const { socket } = renderLobby();

        await user.click(joinButtonFor('Locked Alpha'));
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        // The lobby has only ever been told `hasPassword`.
        expect(JSON.stringify(ROOMS)).not.toContain('"password"');
        expect(
            socket.sent.some((entry) => entry.event.toLowerCase().includes('password')),
        ).toBe(false);
    });

    it('disables Join for a room that is not open', () => {
        const socket = createFakeSocket();
        renderWithSocket(<DrawAndGuessLobby />, { socket });

        act(() => {
            socket.serverEmits('updateDrawAndGuessLobbyRoomList', [
                makeRoom({
                    roomId: 'room-busy',
                    roomName: 'In Progress Room',
                    status: 'In Progress',
                }),
            ]);
        });

        expect(joinButtonFor('In Progress Room')).toBeDisabled();
    });

    it('navigates to the room once the server approves the join', async () => {
        const socket = createFakeSocket();
        renderWithSocket(<DrawAndGuessLobby />, {
            socket,
            path: '/Gamehub/DrawAndGuess/Lobby',
            route: '/Gamehub/DrawAndGuess/Lobby',
            elsewhere: <div>room page</div>,
        });

        act(() => {
            socket.serverEmits(
                'approveClientJoinDrawAndGuessRoomRequest',
                'room-open',
            );
        });

        expect(await screen.findByText('room page')).toBeInTheDocument();
    });
});
