import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../../shared/wire-types';

/** The client end of the contract in `shared/wire-types.d.ts`. */
export type ZumpoSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** How long a request waits for the server's answer before it gives up. */
export const REQUEST_TIMEOUT_MS = 10_000;

/** Reconnection attempts before the client stops and offers "Try again". */
const RECONNECTION_ATTEMPTS = 5;

/**
 * In production the Express server hosts this bundle, so the socket connects
 * to the page's own origin; in development it connects to the backend's port.
 */
function serverUrl(): string | undefined {
  if (import.meta.env.PROD) return undefined;
  return import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3000';
}

/** A socket that waits for `connect()`, so the session decides when to start. */
export function createSocket(): ZumpoSocket {
  return io(serverUrl(), {
    autoConnect: false,
    reconnectionAttempts: RECONNECTION_ATTEMPTS,
    reconnectionDelay: 1000,
    timeout: REQUEST_TIMEOUT_MS,
  });
}
