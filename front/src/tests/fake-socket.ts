import { vi } from 'vitest';

type Listener = (...args: unknown[]) => void;

const addListener = (
    map: Map<string, Listener[]>,
    event: string,
    fn: Listener,
) => {
    map.set(event, [...(map.get(event) ?? []), fn]);
};

interface FakeSocket {
    connected: boolean;
    on: (event: string, listener: Listener) => FakeSocket;
    off: (event: string, listener?: Listener) => FakeSocket;
    emit: (event: string, ...args: unknown[]) => FakeSocket;
    connect: () => void;
    disconnect: () => void;
    io: { on: (event: string, listener: Listener) => void };
    /** Delivers a server event to whatever the component subscribed with. */
    serverEmits: (event: string, ...args: unknown[]) => void;
    /** Every event the component sent, in order. */
    sent: Array<{ event: string; args: unknown[] }>;
    /** The arguments of each `event` the component sent. */
    sentArgs: (event: string) => unknown[][];
}

/**
 * A stand-in for a socket.io client.
 *
 * The real one needs a server, and these tests are about what the components do
 * with what arrives — the transport itself is covered by the backend suite,
 * which runs real clients against a real server.
 */
const createFakeSocket = ({
    connected = true,
}: { connected?: boolean } = {}): FakeSocket => {
    const listeners = new Map<string, Listener[]>();
    const managerListeners = new Map<string, Listener[]>();
    const sent: Array<{ event: string; args: unknown[] }> = [];

    const socket: FakeSocket = {
        connected,

        on: (event, fn) => {
            addListener(listeners, event, fn);
            return socket;
        },

        // socket.io removes every listener for an event when given no function.
        off: (event, fn) => {
            if (!fn) {
                listeners.delete(event);
            } else {
                listeners.set(
                    event,
                    (listeners.get(event) ?? []).filter(
                        (listener) => listener !== fn,
                    ),
                );
            }
            return socket;
        },

        emit: (event, ...args) => {
            sent.push({ event, args });
            return socket;
        },

        connect: vi.fn(() => {
            socket.connected = true;
        }),

        disconnect: vi.fn(() => {
            socket.connected = false;
        }),

        io: {
            on: (event, fn) => addListener(managerListeners, event, fn),
        },

        serverEmits: (event, ...args) => {
            for (const listener of [
                ...(listeners.get(event) ?? []),
                ...(managerListeners.get(event) ?? []),
            ]) {
                listener(...args);
            }
        },

        sent,

        sentArgs: (event) =>
            sent
                .filter((entry) => entry.event === event)
                .map((entry) => entry.args),
    };

    return socket;
};

export { createFakeSocket };
export type { FakeSocket };
