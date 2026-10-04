import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../../shared/wire-types';
import type { ZumpoSocket } from '../net/socket';

type Listener = (...args: never[]) => void;
type ClientEvent = keyof ClientToServerEvents;
type ServerEvent = keyof ServerToClientEvents;

/** The arguments a client event carries, without its ack. */
type RequestArgs<E extends ClientEvent> =
  Parameters<ClientToServerEvents[E]> extends [...infer Args, infer Last]
    ? Last extends (answer: never) => void
      ? Args
      : Parameters<ClientToServerEvents[E]>
    : never;

/** What a client event's ack is called with. */
type AnswerOf<E extends ClientEvent> =
  Parameters<ClientToServerEvents[E]> extends [...unknown[], infer Last]
    ? Last extends (answer: infer A) => void
      ? A
      : never
    : never;

type Responder = (...args: never[]) => unknown;

/**
 * A stand-in for the socket.io client: the tests play the server.
 *
 * The real transport is covered by the backend suite, which runs real clients
 * against a real server; these tests are about what the app does with what
 * arrives.
 */
export class FakeSocket {
  connected = false;
  active = false;
  /** Every plain emit the app made, in order. */
  readonly sent: { event: ClientEvent; args: unknown[] }[] = [];
  /** Every request the app made, answered or not. */
  readonly requests: { event: ClientEvent; args: unknown[] }[] = [];

  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly managerListeners = new Map<string, Set<Listener>>();
  private readonly responders = new Map<string, Responder>();

  readonly io = {
    on: (event: string, listener: Listener) => {
      add(this.managerListeners, event, listener);
    },
    off: (event: string, listener: Listener) => {
      this.managerListeners.get(event)?.delete(listener);
    },
  };

  on(event: string, listener: Listener): this {
    add(this.listeners, event, listener);
    return this;
  }

  off(event: string, listener?: Listener): this {
    // The real client drops every listener when given none, which the app
    // must never rely on; failing loudly keeps that out of the code.
    if (!listener) throw new Error(`off('${event}') without a handler`);
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  emit(event: ClientEvent, ...args: unknown[]): this {
    this.sent.push({ event, args });
    return this;
  }

  timeout(_ms: number) {
    return {
      emitWithAck: (event: ClientEvent, ...args: unknown[]) => {
        this.requests.push({ event, args });
        const responder = this.responders.get(event);
        if (!responder) return new Promise(() => {});
        return Promise.resolve().then(() =>
          (responder as (...a: unknown[]) => unknown)(...args),
        );
      },
    };
  }

  connect(): this {
    this.active = true;
    return this;
  }

  disconnect(): this {
    const was = this.connected;
    this.connected = false;
    this.active = false;
    if (was) this.fire('disconnect', 'io client disconnect');
    return this;
  }

  /** How the server answers a request from now on. */
  answer<E extends ClientEvent>(
    event: E,
    respond: (...args: RequestArgs<E>) => AnswerOf<E>,
  ): void {
    this.responders.set(event, respond as Responder);
  }

  /** The handshake completes. */
  open(): void {
    this.connected = true;
    this.active = true;
    this.fire('connect');
  }

  /** The connection drops, and the client starts retrying. */
  drop(reason = 'transport close'): void {
    this.connected = false;
    this.fire('disconnect', reason);
  }

  /** The client ran out of retries. */
  giveUp(): void {
    this.active = false;
    for (const listener of this.managerListeners.get('reconnect_failed') ??
      []) {
      (listener as () => void)();
    }
  }

  /** The server sends an event. */
  serverEmits<E extends ServerEvent>(
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ): void {
    this.fire(event, ...args);
  }

  /** The arguments of each `event` the app sent. */
  sentArgs(event: ClientEvent): unknown[][] {
    return this.sent.filter((s) => s.event === event).map((s) => s.args);
  }

  /** How many listeners are attached to `event`. */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  asSocket(): ZumpoSocket {
    return this as unknown as ZumpoSocket;
  }

  private fire(event: string, ...args: unknown[]): void {
    // A copy, as socket.io takes: a listener may remove itself as it runs.
    for (const listener of Array.from(this.listeners.get(event) ?? [])) {
      (listener as (...a: unknown[]) => void)(...args);
    }
  }
}

function add(map: Map<string, Set<Listener>>, event: string, fn: Listener) {
  const set = map.get(event) ?? new Set();
  set.add(fn);
  map.set(event, set);
}
