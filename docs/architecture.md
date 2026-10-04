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
tools/   figma-export, figma-bridge, design-tokens: Figma into the repo (see design.md)
```

| Path                                        | What it is                                                         |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `back/app.ts`                               | `createIconIoServer()`: builds a fully wired server without a port |
| `back/server.ts`                            | Entry point that binds the port                                    |
| `back/libs/rooms/`                          | The generic room layer (table below)                               |
| `back/socket/draw-and-guess/`               | Draw & Guess module                                                |
| `back/socket/minesweeper/`                  | Minesweeper module, board, solver and scoring                      |
| `back/socket/player-session-handler.ts`     | The identity handshake                                             |
| `back/socket/client-disconnect-handler.ts`  | Hands a dropped socket to `membership.ts`                          |
| `back/libs/validation.ts`, `rate-limit.ts`  | Inbound validation and per-socket token buckets                    |
| `shared/wire-types.d.ts`                    | Every event name and payload shape                                 |
| `front/src/app.tsx`                         | Routes and their guards                                            |
| `front/src/net/`                            | The socket, the session, and the lobby and room hooks              |
| `front/src/shell/`, `front/src/pages/`      | The page frame and the platform pages                              |
| `front/src/room/`                           | What both rooms share: seating, layout, panels, dialogs            |
| `front/src/draw-and-guess/`, `minesweeper/` | Each game's room view                                              |
| `front/src/ui/`                             | The Zumpo design system: components, base styles, generated tokens |
| `front/src/ui/gallery/`                     | The development-only `/design` page that reviews it against Figma  |

There is no database and no business HTTP API.
Everything except serving static files happens over Socket.io, and server state is one flat registry of rooms of every game, owned by [`back/libs/rooms/registry.ts`](../back/libs/rooms/registry.ts).
Restarting the server drops every room.
That is a conscious trade for a hobby project, and it also means one process: scaling out needs a decision about where each room's state and clock live, which a Socket.IO Redis adapter alone does not answer.

`createIconIoServer()` exists so the server is testable: when these objects were module-level, importing anything meant taking port 3000.

## The room layer

A room is `Room<TGameState>`: a name, an owner, a password, seats keyed by player id, one clock, and a `game` field the room layer never looks inside.
Each game registers a module implementing `GameModule` in [`libs/rooms/types.ts`](../back/libs/rooms/types.ts), and the layer reaches a game only through it.

| File (`back/libs/rooms/`) | Responsibility                                                       |
| ------------------------- | -------------------------------------------------------------------- |
| `types.ts`                | `Room<TGameState>` and the `GameModule` interface                    |
| `registry.ts`             | Every room, which module speaks for each, the snapshots and the chat |
| `membership.ts`           | Seats, departures and the reconnect grace                            |
| `lobby-events.ts`         | List rooms, create a room and seat its creator                       |
| `room-events.ts`          | Join, leave, sync and start, answered through acknowledgements       |
| `chat-events.ts`          | Talking in a room, after the game has had its say                    |
| `emit.ts`                 | Typed emit helpers, and `onClientRequest` for acknowledged requests  |

A module reaches the layer through the `GameContext` it is handed: the typed Socket.IO server, the identity registry, and a `RoomLookup` that finds rooms (`ofType` refuses a room of another game), rebroadcasts a lobby (`emitLobby`), sends snapshots (`emitState`) and posts to the chat (`announce`).
`GameModule` is what the layer calls back:

| Member                                    | Called when                                                         |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `parseSettings`, `createState`            | A room is created; `null` from `parseSettings` refuses it           |
| `toLobbyInfo(room)`                       | The lobby list is rebuilt                                           |
| `toRoomState(room, viewerId)`             | A snapshot is sent to one player                                    |
| `syncTo(socket, room, playerId)`          | A page syncs, after its snapshot and chat: anything streamed        |
| `handleChat?(room, playerId, text)`       | A seated player sends chat; answers `chat`, `consumed` or `blocked` |
| `startGame(room, playerId)`               | The owner presses start; throws a `RequestError` to refuse          |
| `onDeparture`, `onDisconnect`, `onReturn` | A seat is given up, held, or taken back                             |
| `disposeRoom`, `dispose`                  | A room, or the server, is going away: drop timers                   |
| `registerHandlers(socket)`                | A connection arrives: wire up the game's own events                 |

A room's chat is a log on the room (`Room.chat`), not a stream: every message gets the next id in that room, the last 100 are kept, and a page that syncs is sent them as `chat:history`.
A player's message is posted under the name on their seat; anything else is an announcement with a `kind` (`system`, `alert` or `success`) the client styles it by.

Two boundaries had to be drawn for the layer to be an abstraction rather than Draw & Guess wearing a hat:

- **Timers.** The layer owns exactly one kind, the seat expiry that holds a disconnected player's place.
  Every other timer belongs to a module, which keeps its own registry and empties it when told to by `disposeRoom`.
- **Per-player state.** `PlayerInfo` carries what every game has: a name, a score, whether they are connected.
  Anything else lives in the module's own state, keyed by the same player id.

Minesweeper was added without editing a line of `libs/rooms/`, though it disagrees with Draw & Guess about almost everything a game can:

|                       | Draw & Guess                            | Minesweeper                      |
| --------------------- | --------------------------------------- | -------------------------------- |
| Timers of its own     | Three (phase, drawer hold, hints)       | One (the round window)           |
| Turn structure        | One player at a time, in a rota         | Everybody at once, per round     |
| Per-player state      | Who scored this turn, and how much      | Each player's pick this round    |
| `syncTo`              | The drawing (`dg:canvas:sync`)          | Nothing: the snapshot has it all |
| `handleChat`          | A correct guess is not chat             | None: every message is chat      |
| Private state         | The word, until the reveal              | The mine layout, forever         |
| Private to one viewer | The word and the choices, to the drawer | Your own pick, until the reveal  |

A lobby is a Socket.IO room per game, so a client that has not subscribed to a game is never sent its rooms.
A new player cannot join a game in progress; that is a product decision, not a limitation of the layer.

## Server authority

The server decides everything a player could gain by lying about.

- **The clock lives in each module's `game-engine.ts`,** one `setTimeout` per room.
  Clients are told how much time is left and render a countdown; nothing they send advances a phase.
  When the drawer's browser used to end each phase, closing that tab hung the room forever.
- **Time is sent as a remaining duration, not a timestamp,** so a client whose clock disagrees with the server's still counts down correctly.
  Every snapshot re-syncs it.
- **Nothing internal is emitted directly.** A module's `toLobbyInfo` and `toRoomState` are the only way a room becomes something a client sees, so the room password and the word being guessed cannot leak through an accidental emit.
- **A snapshot is built per viewer.** `toRoomState(room, viewerId)` leaves out whatever that player may not know (the word for a guesser, another player's pick), and only the registry sends `room:state`, one player at a time.
  A module changes its state and calls `rooms.emitState(room)`; it never emits a snapshot itself, because a room-wide emit would send everybody the same view.
- **Every inbound event is validated** with zod ([`validation.ts`](../back/libs/validation.ts)) before it reaches game state, and **rate-limited** before that ([`rate-limit.ts`](../back/libs/rate-limit.ts)): one token bucket per kind of event, per socket, because a drawing phase is a stream of coordinates and joining a room is a click.
- **The UI's rules are enforced, not assumed.** Only the drawer may draw, and only while drawing; only the owner may start; only a seat-holder may read a room's state or talk in it; a guess is checked by the game's `handleChat` for phase, not-the-drawer and not-already-scored.
- **The drawing is server state too.** The stroke list every client builds is built once more on the server, so a player arriving mid-turn gets the board, and undo is "drop the last stroke" rather than a full-canvas image.

## Identity and reconnection

Rooms are keyed by a server-issued player id, not `socket.id`, which changes on every reload.
A client presents the identity it holds, or `null`, in the Socket.IO handshake (`auth`) of every connection, and the server's first event is `session:ready` with its `SessionInfo`: the identity to keep (new, or the one it claimed if that checked out) and `reconnectGraceMs`, how long a dropped seat is held.
Identity is part of the handshake rather than a first event because the client flushes whatever it sent while offline the moment it connects, before its own `connect` handler runs; as an event, a quick first click reached the server before the identity did and was refused.
Each id is paired with a secret token only its owner receives; without it any player could take any seat, because every id in a room is broadcast to everyone in it.
The client keeps both in `sessionStorage`: per tab, surviving a reload, which is exactly the lifetime a seat should have.
There are no accounts: this is a way to be the same player across a refresh, not the same person across a visit.

A dropped connection is not a departure.
The seat, score, ownership and place in the round are held for thirty seconds ([`membership.ts`](../back/libs/rooms/membership.ts)); leaving deliberately takes effect immediately, and that is the only difference between the two paths.
A drawer's turn is held too, but only for ten seconds and only once drawing has started: long enough for a refresh, short enough that a room whose drawer has really gone is not left watching a frozen canvas.

## The wire contract

Every event name and payload shape is declared once in [`shared/wire-types.d.ts`](../shared/wire-types.d.ts), as the two event maps `ClientToServerEvents` and `ServerToClientEvents`.
The server is `Server<ClientToServerEvents, ServerToClientEvents>`, and its emit helpers in [`emit.ts`](../back/libs/rooms/emit.ts) are generic over the event name, so an event renamed or reshaped on one side stops compiling rather than silently never arriving.
It is types only, imported with `import type`, so nothing resolves at runtime.
Inbound arguments are still handled as `unknown` and parsed with zod: a type says what a well-behaved client sends, not what arrives.

The protocol is snapshot-driven.
Whenever anything visible in a room changes, every seated, connected player is sent `room:state`: the whole room as that player may see it.
A client renders the latest snapshot and keeps no game state of its own, so a refresh, a reconnect or a missed event cannot leave it out of step.
Changes made in one synchronous run are coalesced, so a turn that ends and the next that starts arrive as one snapshot; nothing may count snapshots.
Only the drawing (`dg:canvas:*`) and the chat (`chat:message`, `chat:history`) travel as increments, because they are streams.

A request that can fail takes an acknowledgement as its last argument and is answered once with a `Result`: `{ ok: true, ... }` or `{ ok: false, error: { type, message } }`.
`onClientRequest` splits the acknowledgement off (the last argument, if it is a function), answers `invalidRequest` when the arguments do not parse, and does nothing harmful when a client sent none.
Errors are never broadcast; they go to the one request that caused them.
A request dropped by the rate limiter is answered `invalidRequest` too, so a page awaiting it is not left hanging.

Names are namespaced by concern, not by game: `room:`, `lobby:`, `chat:` and `game:start` belong to the layer; `dg:` to Draw & Guess and `ms:` to Minesweeper.
`LobbyRoomInfo` and `RoomState` are the generic halves, and each game extends them (`DrawAndGuessLobbyRoomInfo` adds `rounds`) rather than carrying an untyped settings blob.

## Frontend

React 19 on the Zumpo design system, with no component library.
Ant Design was removed, decided by Ryan: Paper Pop shares nothing with antd's look, so theming it would have been a permanent fight, and it was most of a 1 MB main bundle.
Zumpo components are built on headless primitives, which bring keyboard and screen-reader behaviour, with our own styles from the Figma tokens.

### The design system

The design system lives in [`front/src/ui/`](../front/src/ui/index.ts), one component per Figma Shared pieces family:

- **[Base UI](https://base-ui.com) for the primitives** (select, dialog, popover, tabs, radio groups, fields, buttons).
  Radix's maintenance has slowed since its authors moved to Base UI, and React Aria is heavier than these few widgets need.
  Base UI exposes state as `data-*` attributes (`data-checked`, `data-highlighted`, `data-popup-open`), which the styles select on.
- **CSS Modules over generated custom properties.**
  `npm run design:tokens` writes `ui/generated/` from the Figma export: `tokens.css` (`--zumpo-*` colours, spacing, radii, text styles as `font` shorthands, shadows), `glyphs.ts` (icon paths), `brushes.ts` (the canvas palette, which JavaScript needs as values) and `drawings.ts` (the sample turtle drawing on the game cards).
  `npm run verify` fails if they are stale.
- **`zumpo.css`** loads the self-hosted fonts and the tokens; the `.zumpo` class scopes the base styles and `.zumpo-page` adds the page canvas.
  Portals (select menus, dialogs, the header menu) carry `.zumpo` themselves, because they render outside the page.
- **Desktop and Phone variants are container queries**, so a component follows its own width, as Figma's `Layout` variants do, wherever a page puts it.
  Pages switch layouts at `(max-width: 640px)`, the width Figma's phone screens are drawn for, through `useMediaQuery(PHONE)` where the markup itself differs: a room's tabs instead of columns, and `FormPage`, which lays a one-question page's card straight on the page.
- **States never change size:** hover borders, selection rings and cell outlines are inset shadows, not borders, so nothing shifts and overlays such as the pick marker cover the whole box.
- **The `/design` gallery** renders every family in the states Figma draws, beside its Figma preview, and measures each specimen against the export.
  It exists only in development (the build drops it), and the Vite dev server serves `design/figma/` at `/__figma` for it.

### Routes

Routes live in [`app.tsx`](../front/src/app.tsx), on a data router so a room can intercept navigation away from it:

| Path                         | Page                                                        |
| ---------------------------- | ----------------------------------------------------------- |
| `/`                          | Home                                                        |
| `/name?next=`                | Choosing a name, then on to `next` (only a path in the app) |
| `/how-to-play`               | Both games' rules                                           |
| `/games`                     | The games                                                   |
| `/games/:game`               | A game's lobby                                              |
| `/games/:game/new`           | Making a room                                               |
| `/games/:game/rooms/:roomId` | A room, and the link a host shares                          |

Everything under `/games` needs a name and sends a player without one to `/name` first, then back.
The room URL carries the game so that a page which cannot reach the room (a password, a room that moved on) still knows which game it belongs to; a link with the wrong game in it redirects to the right one.

### Talking to the server

[`net/`](../front/src/net/) is the only code that touches the socket, typed on the wire contract's two event maps:

- **`session.tsx`** owns the one socket.
  The first page that needs the server connects it; every handshake presents the stored identity, the session goes online at `session:ready`, and the identity and the chosen name are kept in `sessionStorage` (see [identity](#identity-and-reconnection)).
  Its status (`connecting`, `online`, `reconnecting`, `failed`) is what pages show, and `connection` numbers the live connection anew on every `session:ready` (null while offline), so anything the server keeps per connection is set up again by an effect keyed on it.
- **`use-lobby.ts`** subscribes to one game's rooms while online.
- **`use-room.ts`** takes a seat: `room:sync` first, then `room:join` when the server says this player has no seat, then the password page if the room has one.
  It keeps the latest snapshot and when it arrived, the chat, and the drawing as a `CanvasStream`, which lives outside React because a stroke grows dozens of times a second.
  A `notRoomMember` answer after the page has held a seat means the seat was released while away, which the page reports rather than quietly rejoining.
- Requests use `emitWithAck` with a 10 second timeout, and a request that times out is treated as a failure the page can show.

A room page renders the latest `room:state` and nothing else: the client keeps no game state, advances no phase, and counts each clock down from the snapshot that carried it.
Leaving is routed through the navigation blocker, whatever started it (the Leave room button, the wordmark, Change name, the browser's back button), and it sends `room:leave` before the page goes.
Only Leave room between games goes at once; it marks its navigation with `state.via`, and anything else asks first, mid-game or not ([design](design.md#the-room-bar)).
Leaving is never done in an effect's cleanup, where React's development double-mount would give the seat up on arrival.

In production the client connects to the origin that served the page and ignores `VITE_SOCKET_URL` ([`socket.ts`](../front/src/net/socket.ts)).
Serving the frontend from a different host than the backend needs that changed first, plus CORS.

### The drawing canvas

The canvas bitmap is 798 × 598, scaled to the screen's pixel ratio; pointer positions are mapped into that space.
It takes pointer events, so mouse, pen and touch all draw, and `touch-action: none` keeps a finger drawing rather than scrolling.
The server never echoes a drawer's own strokes, so the drawer's input is applied locally as well as sent.

## Configuration

Environment variables for the server are listed in [`back/README.md`](../back/README.md) and for the client in [`front/README.md`](../front/README.md).
Phase lengths are server settings because the server owns the clock; each game documents its own under "Configuration".
The test suite passes durations straight to `createIconIoServer()`, so an environment variable cannot change a suite's timing.

Production is one Node process: Vite builds into `back/build/public` and Express serves it, with Socket.IO on the same HTTP server.
`npm --prefix back run build` empties `back/build/` including the frontend bundle, so the backend must build first; the root `npm run build` does it in that order.
It empties the folder rather than deleting it, and `back/tsconfig.json` names its source folders instead of `**/*.ts`, because TypeScript 7's watcher restarts on any change under a folder it watches: otherwise every e2e or design run restarts a running `npm --prefix back run watch` and loses its rooms.

## Adding a game

1. One `createXModule(ctx, ...)` returning a `GameModule`, and one line in `app.ts` registering it.
   Its engine changes state and calls `ctx.rooms.emitState(room)`; its `toRoomState(room, viewerId)` decides what each player sees.
2. A member added to `GameType`, the game's room state, lobby info and settings interfaces in the shared contract, and its event names in the two unions.
3. An entry in [`games/catalog.ts`](../front/src/games/catalog.ts), the game's fields in [`create-room.tsx`](../front/src/pages/create-room.tsx), which puts them into `settings` (the only part of a create request the server hands to a module), and a room view rendered by [`room-page.tsx`](../front/src/room/room-page.tsx) inside the shared `RoomLayout`.

Nothing in `libs/rooms/` should need editing.
If it does, the abstraction is wrong rather than the game unusual, and that is worth fixing rather than working around.

## Testing

Vitest on both sides.
The backend suite runs real Socket.IO clients against a real server on an ephemeral port per suite, because that is where the interesting behaviour lives, and phase durations are parameters so a whole game runs in milliseconds.
Because it binds ports, it times out in sandboxes that forbid listening on localhost; run it where that is allowed before concluding a test is broken.
The frontend suite renders the whole app in jsdom against a fake socket ([`tests/fake-socket.ts`](../front/src/tests/fake-socket.ts)), with each test playing the server; jsdom has no 2D context, so canvas rendering is verified in a browser only.

Two serious bugs were found only by playing in a browser (a redundant hint, and the lost identity under [pitfalls](#pitfalls)), so UI and flow changes are verified end to end, not just by the suites.
`npm run e2e` does the repeatable part: [Playwright](../e2e/) builds the app, serves it as production does on port 3310 (`E2E_PORT`), and plays the main flows with each player in a browser context of their own.
Reveals are cut to a second so a whole game fits in a test, any error in a browser console fails it, and a player made `droppable` can lose the connection mid-game through `dropConnection`, which cuts both Socket.IO transports; browser offline emulation leaves an open WebSocket alone.
It checks behaviour, not looks.
`npm run design:compare` covers looks: it drives the app into the state of each Figma screen and puts the capture beside Figma's preview ([design](design.md#comparing-with-figma)).

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

- **`room:state` is per viewer.** Emitting it to a Socket.IO room would send the drawer's word to every guesser; call `rooms.emitState(room)` and let the registry build each player's view.
- **Snapshots are coalesced.** `emitState` sends at the end of the synchronous run, so a test waits for a snapshot that satisfies a condition rather than for the next one.
- **`socket.off(event)` without a handler removes everyone's listeners.**
  The Gamehub once cleaned up with `socket.off('connect')`, which also removed the provider's identity handshake: the socket connected, never identified, and every create, join and start was silently dropped until a hard reload.
  Today the same mistake on `session:ready` would leave the session connecting forever.
  Always pass the handler.
- **Build order:** see [configuration](#configuration).
- **Port-binding tests in sandboxes:** see [testing](#testing).
- **DM Sans has no tabular figures**, so `font-variant-numeric: tabular-nums` does nothing.
  A number that ticks in place, like the countdown, sets each digit in a fixed `1ch` cell instead, or it shifts its neighbours every second.
- **Chrome snaps an SVG box at a half pixel to a whole one**, which moves a stroke by a device pixel.
  Keep an SVG's box on whole pixels (cover the parent with `inset: 0`) and place the geometry inside it, as the pick marker's ring does with CSS `x`, `y`, `width` and `height` on its `rect`.
