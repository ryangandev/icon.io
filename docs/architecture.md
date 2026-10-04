# Architecture

How the code is put together, why, and where it bites.
Game rules live in [games/draw-and-guess.md](games/draw-and-guess.md) and [games/minesweeper.md](games/minesweeper.md); this document is about the machinery under them.

## Code map

```
front/   React SPA (Vite) ──── socket.io ────► back/   Express + Socket.io
                                                │
                                                ├── room layer: seats, lobbies, chat
                                                │     └── game modules: own their clocks
                                                └── all state in memory, one registry
shared/  wire-types.d.ts, imported by both sides
tools/   figma-export: read-only Figma exporter (see design.md)
```

| Path                                       | What it is                                                         |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `back/app.ts`                              | `createIconIoServer()`: builds a fully wired server without a port |
| `back/server.ts`                           | Entry point that binds the port                                    |
| `back/libs/rooms/`                         | The generic room layer (table below)                               |
| `back/socket/draw-and-guess/`              | Draw & Guess module                                                |
| `back/socket/minesweeper/`                 | Minesweeper module, board, solver and scoring                      |
| `back/socket/player-session-handler.ts`    | The identity handshake                                             |
| `back/socket/client-disconnect-handler.ts` | Hands a dropped socket to `membership.ts`                          |
| `back/libs/validation.ts`, `rate-limit.ts` | Inbound validation and per-socket token buckets                    |
| `shared/wire-types.d.ts`                   | Every event name and payload shape                                 |
| `front/src/app.tsx`                        | Routes and their guards                                            |
| `front/src/providers/socket-provider.tsx`  | The socket, identity storage and handshake                         |
| `front/src/components/require-socket.tsx`  | Holds a page until the socket is connected                         |
| `front/src/components/validate-auth.tsx`   | Holds a page until there is a username                             |
| `front/src/pages/lobbies/`, `pages/rooms/` | One lobby and one room page per game                               |

There is no database and no business HTTP API.
Everything except serving static files happens over Socket.io, and server state is one flat registry of rooms of every game, owned by [`back/libs/rooms/registry.ts`](../back/libs/rooms/registry.ts).
Restarting the server drops every room.
That is a conscious trade for a hobby project, and it also means one process: scaling out needs a decision about where each room's state and clock live, which a Socket.IO Redis adapter alone does not answer.

`createIconIoServer()` exists so the server is testable: when these objects were module-level, importing anything meant taking port 3000.

## The room layer

A room is `Room<TGameState>`: a name, an owner, a password, seats keyed by player id, one clock, and a `game` field the room layer never looks inside.
Each game registers a module implementing `GameModule` in [`libs/rooms/types.ts`](../back/libs/rooms/types.ts), and the layer reaches a game only through it.

| File (`back/libs/rooms/`) | Responsibility                                    |
| ------------------------- | ------------------------------------------------- |
| `types.ts`                | `Room<TGameState>` and the `GameModule` interface |
| `registry.ts`             | Every room, and which module speaks for each      |
| `membership.ts`           | Seats, departures and the reconnect grace         |
| `lobby-events.ts`         | List rooms, create room                           |
| `room-events.ts`          | Join / leave / re-sync / start                    |
| `chat-events.ts`          | Talking in a room                                 |
| `emit.ts`                 | Typed emit and listener helpers                   |

Two boundaries had to be drawn for the layer to be an abstraction rather than Draw & Guess wearing a hat:

- **Timers.** The layer owns exactly one kind, the seat expiry that holds a disconnected player's place.
  Every other timer belongs to a module, which keeps its own registry and empties it when told to by `disposeRoom`.
- **Per-player state.** `PlayerInfo` carries what every game has: a name, a score, whether they are connected.
  Anything else lives in the module's own state, keyed by the same player id.

Minesweeper was added without editing a line of `libs/rooms/`, though it disagrees with Draw & Guess about almost everything a game can:

|                   | Draw & Guess                       | Minesweeper                    |
| ----------------- | ---------------------------------- | ------------------------------ |
| Timers of its own | Three (phase, drawer hold, hints)  | One (the round window)         |
| Turn structure    | One player at a time, in a rota    | Everybody at once, per round   |
| Per-player state  | Who has scored this turn           | None beyond the shared score   |
| `syncTo`          | Canvas, plus the drawer's own word | Empty: the snapshot has it all |
| Private state     | The word, until the reveal         | The mine layout, forever       |

A lobby is a Socket.IO room per game, so a client that has not subscribed to a game is never sent its rooms.
A new player cannot join a game in progress; that is a product decision, not a limitation of the layer.

## Server authority

The server decides everything a player could gain by lying about.

- **The clock lives in each module's `game-engine.ts`,** one `setTimeout` per room.
  Clients are told how much time is left and render a countdown; nothing they send advances a phase.
  When the drawer's browser used to end each phase, closing that tab hung the room forever.
- **Time is sent as a remaining duration, not a timestamp,** so a client whose clock disagrees with the server's still counts down correctly.
  Every phase event and every room snapshot re-syncs it.
- **Nothing internal is emitted directly.** A module's `toLobbyInfo` and `toRoomState` are the only way a room becomes something a client sees, so the room password and the word being guessed cannot leak through an accidental emit.
  Secrets are omitted, not blanked, so the drawer's own copy survives a client-side merge.
- **Every inbound event is validated** with zod ([`validation.ts`](../back/libs/validation.ts)) before it reaches game state, and **rate-limited** before that ([`rate-limit.ts`](../back/libs/rate-limit.ts)): one token bucket per kind of event, per socket, because a drawing phase is a stream of coordinates and joining a room is a click.
- **The UI's rules are enforced, not assumed.** Only the drawer may draw, and only while drawing; only the owner may start; only a seat-holder may read a room's state; a guess is checked for membership, phase, not-the-drawer and not-already-scored.
- **The drawing is server state too.** The stroke list every client builds is built once more on the server, so a player arriving mid-turn gets the board, and undo is "drop the last stroke" rather than a full-canvas image.

## Identity and reconnection

Rooms are keyed by a server-issued player id, not `socket.id`, which changes on every reload.
Each id is paired with a secret token only its owner receives; without it any player could take any seat, because every id in a room is broadcast to everyone in it.
The client keeps both in `sessionStorage`: per tab, surviving a reload, which is exactly the lifetime a seat should have.
There are no accounts: this is a way to be the same player across a refresh, not the same person across a visit.

A dropped connection is not a departure.
The seat, score, ownership and place in the round are held for thirty seconds ([`membership.ts`](../back/libs/rooms/membership.ts)); leaving deliberately takes effect immediately, and that is the only difference between the two paths.
A drawer's turn is held too, but only for ten seconds and only once drawing has started: long enough for a refresh, short enough that a room whose drawer has really gone is not left watching a frozen canvas.

## The wire contract

Every event name and payload shape is declared once in [`shared/wire-types.d.ts`](../shared/wire-types.d.ts), and both packages route emits and listeners through helpers typed on it.
An event renamed on one side only stops compiling rather than silently never arriving.
It is types only, imported with `import type`, so nothing resolves at runtime; that is why event names are a union of string literals rather than an object of constants.

Names are namespaced by concern, not by game: `room:`, `lobby:`, `chat:` and `game:start` belong to the layer; `dg:` to Draw & Guess and `ms:` to Minesweeper.
`LobbyRoomInfo` and `RoomState` are the generic halves, and each game extends them (`DrawAndGuessLobbyRoomInfo` adds `rounds`) rather than carrying an untyped settings blob.

## Frontend

React 19 with Ant Design 6 components and per-component CSS files under `front/src/styles/`.
The Zumpo redesign will replace most of this layer; see [status.md](status.md) before investing in the current UI.
Ant Design is being removed, decided by Ryan: Paper Pop shares nothing with antd's look, so theming it would be a permanent fight, and it is most of the 1 MB main bundle.
Zumpo components are built on headless primitives, which bring keyboard and screen-reader behaviour, with our own styles from the Figma tokens.

Routes live in [`app.tsx`](../front/src/app.tsx): `/` and `/Landing`, then behind `ValidateAuth` (needs a username) `/Gamehub`, and behind `RequireSocket` (needs a connection) `/Gamehub/<Game>/Lobby` and `/Gamehub/<Game>/Room/:roomId`.
`RequireSocket` opens the connection instead of redirecting, and redirects only on real failure, so a refresh or a deep link lands where it was.
It gives up after 10 seconds, which is shorter than a free hosting tier's cold start; revisit when a host is chosen.

In production the client connects to the origin that served the page and ignores `VITE_SOCKET_URL` ([`socket-provider.tsx`](../front/src/providers/socket-provider.tsx)).
Serving the frontend from a different host than the backend needs that changed first, plus CORS.

The whiteboard canvas bitmap is 798 × 598; mouse positions are scaled into bitmap space, and it handles mouse events only.

## Configuration

Environment variables for the server are listed in [`back/README.md`](../back/README.md) and for the client in [`front/README.md`](../front/README.md).
Phase lengths are server settings because the server owns the clock; each game documents its own under "Configuration".
The test suite passes durations straight to `createIconIoServer()`, so an environment variable cannot change a suite's timing.

Production is one Node process: Vite builds into `back/build/public` and Express serves it, with Socket.IO on the same HTTP server.
`npm --prefix back run build` wipes `back/build/` including the frontend bundle, so the backend must build first; the root `npm run build` does it in that order.

## Adding a game

1. One `createXModule(ctx, …)` returning a `GameModule`, and one line in `app.ts` registering it.
2. A member added to `GameType`, the game's room state, lobby info and settings interfaces in the shared contract, and its event names in the two unions.
3. A lobby page and a room page.
   `RoomCreateForm` takes the game-specific fields as children and puts them into `settings`, the only part of a create request the server hands to a module.

Nothing in `libs/rooms/` should need editing.
If it does, the abstraction is wrong rather than the game unusual, and that is worth fixing rather than working around.

## Testing

Vitest on both sides.
The backend suite runs real Socket.IO clients against a real server on an ephemeral port per suite, because that is where the interesting behaviour lives, and phase durations are parameters so a whole game runs in milliseconds.
Because it binds ports, it times out in sandboxes that forbid listening on localhost; run it where that is allowed before concluding a test is broken.
The frontend suite uses jsdom with a fake socket; jsdom has no 2D context, so canvas rendering is verified in a browser only.

Two serious bugs were found only by playing in a browser (a redundant hint, and the lost identity under [pitfalls](#pitfalls)), so UI and flow changes are verified end to end, not just by the suites.

## Tooling

- **Vite** replaced Create React App, which pinned eslint 8 and webpack 5 and blocked React 19 and TypeScript 5+.
- **`react-router`, not `react-router-dom`:** since v7 the `-dom` package is a re-export shim, and its 7.x line pulled in a core with a high-severity advisory.
- **oxlint, not ESLint:** `typescript-eslint` refuses TypeScript 7 (support tracked for TS ≥ 7.1 in typescript-eslint#10940).
  Keeping the Go compiler beats keeping a linter, `tsc --strict` already rejects what the type-aware rules would catch, and switching back is a config file because the rule names are ESLint's.
  Revisit when typescript-eslint supports TS 7.
- **Root tooling, separate apps:** the root `package.json` carries lint, format and orchestration only; `back/` and `front/` keep their own dependencies and lockfiles.
  It is deliberately not an npm workspace.
- **Strict TypeScript** with `noImplicitAny`, `verbatimModuleSyntax` and `noUnusedLocals`.

## Pitfalls

- **`socket.off(event)` without a handler removes everyone's listeners.**
  The Gamehub once cleaned up with `socket.off('connect')`, which also removed the provider's identity handshake: the socket connected, never identified, and every create, join and start was silently dropped until a hard reload.
  Always pass the handler.
- **Build order:** see [configuration](#configuration).
- **Port-binding tests in sandboxes:** see [testing](#testing).
