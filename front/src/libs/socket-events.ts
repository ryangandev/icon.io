import type { Socket } from 'socket.io-client';
import type {
  ClientToServerEvent,
  ServerToClientEvent,
} from '../../../shared/wire-types';

/**
 * Every emit and every listener on this side goes through here, so that an
 * event name is checked against the shared contract rather than spelled out
 * twice across the socket and hoped about.
 *
 * A renamed event compiles perfectly on the half that was not renamed, and
 * simply stops arriving — which is a silent failure by construction, and the
 * one thing about a socket API that a type system can actually prevent. With
 * one game and a dozen names it was survivable; with two games and forty it is
 * not.
 */

type Handler = (...args: never[]) => void;

const emit = (
  socket: Socket,
  event: ClientToServerEvent,
  ...args: unknown[]
): void => {
  socket.emit(event, ...args);
};

const on = <TArgs extends unknown[]>(
  socket: Socket,
  event: ServerToClientEvent,
  handler: (...args: TArgs) => void,
): void => {
  socket.on(event, handler as (...args: unknown[]) => void);
};

/**
 * Removes one listener, or every listener for the event when given no handler.
 *
 * The branch is load-bearing rather than tidy. socket.io's emitter decides
 * which of those two it is by `arguments.length`, so forwarding an undefined
 * handler is not the same thing as omitting it — it looks for a listener
 * identical to `undefined`, finds none, and removes nothing at all. Every
 * `off(socket, event)` in this app would silently leak its listener, and a
 * component that mounts twice would handle each message twice.
 */
const off = (
  socket: Socket,
  event: ServerToClientEvent,
  handler?: Handler,
): void => {
  if (handler) {
    socket.off(event, handler as (...args: unknown[]) => void);
  } else {
    socket.off(event);
  }
};

export { emit, on, off };
