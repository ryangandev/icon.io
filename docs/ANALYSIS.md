# Icon.io — Project Analysis

_Written 2026-07-25 after the dependency modernization pass; updated 2026-07-26
after the bug-fix and reconnection passes._

This is a snapshot of what the project does today, what's broken, and what it
would take to grow it into an ongoing hobby project. Roughly 5,000 lines of
TypeScript across `front/` (React SPA) and `back/` (Express + Socket.io).

---

## 1. Architecture in one page

```
front/  React SPA ──── socket.io ────► back/  Express + Socket.io
                                            │
                                            ├── game engine (owns the clock)
                                            └── all game state in memory
                                                (two plain objects)
```

**There is no database and no HTTP API.** Everything except serving static files
happens over Socket.io. Server state lives in two plain objects owned by
[`back/app.ts`](../back/app.ts):

```ts
const rooms: Record<string, DrawAndGuessDetailRoomInfo> = {};
```

Restarting the server drops every room. For a hobby project that's a perfectly
reasonable trade — it just needs to be a conscious one.

`createIconIoServer()` builds a fully wired server without starting it, and
[`back/server.ts`](../back/server.ts) is now just the entry point that binds a
port. That split is what makes the server testable: these objects used to be
module-level, so importing anything meant taking port 3000.

**Handler layout** (`back/socket/draw-and-guess/`):

| File                                  | Responsibility                             |
| ------------------------------------- | ------------------------------------------ |
| `game-engine.ts`                      | The turn state machine and the phase clock |
| `lobby-events-handler.ts`             | List rooms, create room                    |
| `room-events-handler.ts`              | Join / leave, ownership transfer           |
| `game-events-handler.ts`              | Socket glue over the engine                |
| `chat-events-handler.ts`              | Chat messages and guess checking           |
| `whiteboard-canvas-events-handler.ts` | Relay draw / undo / clear events           |
| `membership.ts`                       | Seats, departures and the reconnect grace  |
| `../player-session-handler.ts`        | The identity handshake                     |
| `../client-disconnect-handler.ts`     | Hands a dropped socket to `membership.ts`  |

**The server is authoritative.** This is the main structural change from the
original design, and it is worth stating plainly because everything else follows
from it:

- **The clock lives in `game-engine.ts`**, one `setTimeout` per room. Clients are
  told how much time is left and render a countdown; nothing they send advances
  a phase. Previously the drawer's browser emitted the events that ended each
  phase, so closing that tab hung the room forever.
- **Time is sent as a remaining duration, not a timestamp**, so a client whose
  clock disagrees with the server's still counts down correctly. Every phase
  event and every room snapshot re-syncs it.
- **Nothing internal is emitted directly.** Two wire types, `LobbyRoomInfo` and
  `DrawAndGuessRoomState`, are built by `back/libs/utils.ts`, and they are what
  a client sees. Secrets — the room password, and the word while it is still
  being guessed — cannot leak by someone emitting a room object by accident.
- **Every inbound event is validated** ([`back/libs/validation.ts`](../back/libs/validation.ts))
  before it reaches game state.
- **The UI's rules are enforced, not assumed** — with two exceptions the canvas
  and the start button still have, see §3.1.

**Identity outlives the connection.** Rooms are keyed by a server-issued player
id, not by `socket.id`, which changes on every reload. Each id is paired with a
secret token that only its owner receives — without one, any player could take
any other player's seat, because every id in a room is broadcast to everyone in
it. The client keeps both in `sessionStorage`: per tab, and surviving a reload,
which is exactly the lifetime a seat should have.

There are still no accounts. This is a way to be the same player across a
refresh, not a way to be the same person across a visit.

**A dropped connection is not a departure.** The seat, the score, ownership and
the place in the round are held for thirty seconds
([`membership.ts`](../back/socket/draw-and-guess/membership.ts)) in case the
player comes back. Leaving deliberately still takes effect immediately — that
distinction is the only difference between the two paths, which used to be
separate near-identical copies of the same sequence.

---

## 2. What's actually built

### Working end to end

Verified by playing full two-player games against a production build, and by
driving scripted socket.io clients through the same flows.

- **Landing → username** stored in `sessionStorage`, gated by `ValidateAuth`.
- **Gamehub** with a game picker.
- **Lobby**: live-updating room table, create room (name, 2–8 players, 1–4
  rounds, optional password), join, password prompt.
- **Room**: live player list with ranking, points, owner crown, drawer pencil.
- **Game loop**: owner starts (min 2 players) → one random word category per
  game → each round every player draws once, in random order. Every phase
  boundary below is decided by the server. Per turn:
  - **Word select**, 15s — drawer picks from 3 words; the server picks the first
    on timeout, whether or not the drawer's browser is still there.
  - **Drawing**, 90s — drawer draws, everyone else sees `_ _ _ _` length hints.
  - **Review**, 10s — the word is revealed.
- **Whiteboard**: freehand drawing, colour picker, 4 brush sizes, undo, clear,
  all broadcast to the room as strokes.
- **Chat**: doubles as the guess channel during the drawing phase. A correct
  guess awards **+100** to the guesser and **+40** to the drawer, once per turn.
  Matching is case-insensitive. The drawer cannot guess and neither can anyone
  who has already scored — enforced server-side, not just in the UI.
- **Departures**: player removed, ownership transferred, empty rooms deleted. If
  the player who left was drawing, the turn is skipped; if the room drops below
  two players mid-game, the game ends rather than stalling.
- **Reconnection**: a reload keeps your seat, your score, the crown and your
  place in the round. Others see you marked away rather than gone. The turn does
  not wait for you, though — see §3.1.

### Word bank

6 categories in [`back/libs/word-bank.ts`](../back/libs/word-bank.ts): Fruits,
Animals, League Of Legends, Electronics, Sports, Food.

### Stubs and dead code

- **Minesweeper** — the Gamehub tile links to `/Gamehub/Minesweeper/Lobby`, which
  has no route and lands on the 404 page. Art assets exist; nothing else does.
- The old `ValidateAuth` implementation is left commented out at the top of
  [`front/src/components/validate-auth.tsx`](../front/src/components/validate-auth.tsx).

---

## 3. Bugs

Everything this document has ever listed as 🔴, 🟠 or 🟡 is fixed, each as its
own commit, each verified against a running server rather than by reading the
diff — see §3.2 for the index. §3.1 is what is still open, including three
issues found on 2026-07-26 that were not on any earlier list.

### 3.1 Open

#### 🟠 Nobody checks who is drawing

[`whiteboard-canvas-events-handler.ts`](../back/socket/draw-and-guess/whiteboard-canvas-events-handler.ts)
relays `startDrawing`, `continueDrawing`, `stopDrawing`, `undo` and `clear` to
whatever room id it is handed. It validates the payload's _shape_ and nothing
else: not that the sender is in the room, not that the sender is the drawer, not
that a drawing phase is running. It is the one handler that never received the
membership check the guess path got.

Room ids are not secret — the lobby list is `io.emit`-ed to every connected
client, and it carries `roomId` for every room. So any client that opens the
lobby learns the id of every room, including locked ones.

_Verified_ with a throwaway probe: a client that never joined a room and never
had its password drew a stroke on it, undid the drawer's last stroke, and
cleared the canvas — all three reached the owner. `clear` is the worst of them:
one emit wipes a stranger's drawing mid-turn, and it costs the attacker nothing.

The fix is the shape already used by `chat-events-handler.ts`: resolve the
player id from the socket, check they hold a seat in that room, and for the
draw events check they are `room.currentDrawer` during `isDrawingPhase`. The
handler currently takes only `socket`, so it needs `rooms` and `sessions`
passed in from `app.ts`.

#### 🟠 Nobody checks who starts the game

`startGame(roomId)` in [`game-engine.ts`](../back/socket/draw-and-guess/game-engine.ts)
checks that the room exists, that a game is not already running, and that there
are enough players — but not who asked. Any connected client can start any
room's game with a room id off the lobby broadcast. The Start button is
owner-only in the UI and nowhere else.

Same fix, one line: compare `sessions.playerIdFor(socket.id)` against
`room.owner.playerId`. `selectWord` next to it already does exactly this against
`room.currentDrawer`, so the pattern is in the file.

#### 🟠 Arriving mid-turn shows you a blank canvas

The drawing lives only in each client's memory. The server relays stroke events
and keeps none of them, so anyone who arrives after a stroke was drawn — a
joiner, or a player coming back from a reload — sees an empty board until the
drawer happens to draw again.

This is also the reason a reloading drawer loses their turn rather than resuming
it: `skipTurnOfAbsentDrawer` moves on immediately, because a returning drawer
would find their own drawing gone. Storing the stroke list server-side and
sending it with the room snapshot fixes the joiner, the reconnecting watcher and
the reconnecting drawer in one change. The undo rewrite already put the drawing
in a replayable form for exactly this.

#### 🟢 A non-member can read a private room's player list

`requestDrawAndGuessRoomState` answers any connected client. The payload holds
no secrets — no password, no live word — but a locked room's player list is not
something a stranger should be able to pull. The membership check above covers
this too.

#### 🟢 Smaller things

- **No rate limiting on any socket event.** Payloads are bounded now; their
  frequency is not. A client can emit `startDrawing` in a loop.
- **The word hint never progressively reveals letters** — it is the same row of
  underscores for the whole 90 seconds.
- **`validate-auth.tsx` calls `window.location.reload()`** after setting a
  username, which throws away the SPA. It also still has a `console.log` and 20
  lines of the previous implementation commented out at the top of the file.
- **The Minesweeper tile links to a route that does not exist** and lands on the
  404 page.
- **Filename typo**: `password-prmopt-modal.tsx`.
- **11 lint warnings**, none of them wrong exactly: three `no-shadow` in the room
  page, two `no-explicit-any` on caught errors, `no-unstable-nested-components`
  in the lobby table, and `Array#sort` mutating in `front/src/libs/utils.ts`.
  That last one is the only one that could bite.
- **Canvas rendering is the one thing the suite does not cover**: jsdom has no 2D
  context. The relay protocol around it is covered, and the drawing itself was
  verified in two browsers when it landed.
- **`front/src/models/types.ts` and `back/models/types.ts` are near-identical
  copies** that must be edited in lockstep. Not a bug yet; a bug generator.

### 3.2 Fixed

The reasoning behind each of these is in its commit message and in the pull
request it landed in ([#22](https://github.com/ryangandev/icon.io/pull/22),
[#23](https://github.com/ryangandev/icon.io/pull/23)). Every one is covered by
the committed suite: the ten from the bug-fix pass were checked by reverting
each in turn and confirming the suite catches it, and reconnection has 19 tests
of its own.

| Was                                                        | Now                                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 🔴 Room passwords broadcast in plaintext to every client   | Wire types: the lobby carries `hasPassword`, the room snapshot drops the password                 |
| 🔴 The live word leaked in every leave event during a turn | `currentWord`/`wordChoices` are _omitted_, not blanked, so the drawer's own copy survives a merge |
| 🔴 Phase timing came from the drawer's browser             | `game-engine.ts` owns one `setTimeout` per room and drives every transition                       |
| 🟠 The password prompt rendered once per table row         | One modal hoisted out of the table, keyed by room id                                              |
| 🟠 Nothing a client sent was validated                     | zod schemas over every inbound event; invalid events dropped and logged                           |
| 🟠 The drawing toolbar sat below the fold at 720p          | Toolbar above the canvas; mouse positions scaled into bitmap space                                |
| 🟠 A refresh or a deep link bounced you to the Gamehub     | The guard opens the connection instead of redirecting; it redirects only on real failure          |
| 🟠 A reload made you a different person                    | Server-issued player id + token, and a thirty-second seat hold                                    |
| 🟡 Undo shipped a full-canvas PNG, per undo                | A stroke list every client replays; undo is "drop the last entry"                                 |
| 🟡 A 250 ms `setTimeout` papered over a join race          | The room page asks for state once its listeners are live                                          |
| 🟡 Guess authority was client-side only                    | Sender is checked for membership, phase, not-the-drawer, and not-already-scored                   |
| 🟡 `socketInRooms[socket.id]` could be undefined           | Guarded, and membership checked before anything is mutated                                        |

Fixed earlier, during the modernization pass: a reviewing-phase timer that fired
after you left the room; `playerList[socket.id]` indexed with a possibly
`undefined` id; `getRandomElementFromSet` returning `undefined` while typed
`string`; `wordCategory` typed `string` and used as a `WordCategory` key;
`app.get('/*')`, invalid in Express 5; `back/build/` committed to git; and
`@ant-design/icons` imported but never declared.

---

## 4. Modernization: what changed

|                  | Before                                | After                     |
| ---------------- | ------------------------------------- | ------------------------- |
| Build (front)    | react-scripts 5.0.1 (CRA, deprecated) | **Vite 8**                |
| React            | 18.2                                  | **19.2**                  |
| Ant Design       | 5.9                                   | **6.5**                   |
| Router           | react-router-dom 6.8                  | **react-router 8.3**      |
| TypeScript       | 4.9                                   | **7.0**                   |
| Express          | 4.19                                  | **5.2**                   |
| Socket.io        | 4.7                                   | **4.8**                   |
| Lint             | CRA built-in (eslint 8)               | **oxlint**, both packages |
| Tests            | none                                  | **132** (Vitest)          |
| CI               | none                                  | **GitHub Actions**        |
| Formatting       | script, no config                     | **Prettier, 2-space**     |
| Node             | 18 types                              | **20+**, `@types/node` 26 |
| Frontend install | ~1,500 packages                       | **106**                   |
| Backend install  | ~800 packages                         | **129**                   |
| Prod build time  | ~30 s                                 | **~0.8 s**                |
| `npm audit`      | 2 high (react-router CSRF)            | **0**                     |

**Notable decisions:**

- **CRA had to go.** `react-scripts` last shipped in 2022 and pins eslint 8 and
  webpack 5; it blocks React 19 and TypeScript 5+. Vite replaces it, and the
  build now writes straight into `back/build/public` instead of building locally
  and `mv`-ing.
- **`react-router-dom` → `react-router`.** `react-router-dom@7.18.1` pulls in a
  core with a high-severity advisory (GHSA-qwww-vcr4-c8h2, RSC-mode CSRF).
  `react-router@8.3.0` is above the affected range, and since v7 the `-dom`
  package is just a re-export shim, so importing the core directly is both the
  fix and the modern idiom.
- **oxlint instead of ESLint — settled.** `typescript-eslint` hard-refuses
  TypeScript 7 (it errors out on load; support is tracked for TS ≥ 7.1 in
  typescript-eslint#10940). As of 8.65.0 it still declares
  `typescript: >=4.8.4 <6.1.0`, so the choice is unchanged: pin TypeScript back
  to 5.9 to use it, or keep oxlint. **Keeping oxlint.** Giving up the Go
  compiler for a linter is a bad trade, `tsc --strict` already rejects the type
  errors the type-aware rules would catch, and switching back is a config file —
  the rules are ESLint's, under the same names. Worth revisiting when
  typescript-eslint ships TS 7 support, not before.
- **Dropped 12 unused dependencies**: `argon2`, `axios` (both sides),
  `cookie-parser`, `zod`, `jest`, `ts-jest`, `ts-node`, `web-vitals`,
  `react-icons`, and all three `@testing-library/*` packages. None were imported
  anywhere. `uuid` was replaced by the built-in `crypto.randomUUID()`.
  (`zod` has since come back, and is now actually used — see §3.2.)
- **Stricter TypeScript.** `noImplicitAny` was off; turning it on surfaced four
  real type holes. `verbatimModuleSyntax` and `noUnusedLocals` are now on too.

### Server settings

The server owns the game clock, so phase lengths are server-side settings.
Shorten them to play a whole game through in seconds while developing:

| Variable                  | Default | Purpose                                    |
| ------------------------- | ------- | ------------------------------------------ |
| `WORD_SELECT_SECONDS`     | `15`    | How long the drawer has to pick a word     |
| `DRAWING_SECONDS`         | `90`    | Length of the drawing phase                |
| `REVIEW_SECONDS`          | `10`    | How long the word is shown after a turn    |
| `RECONNECT_GRACE_SECONDS` | `30`    | How long a dropped player keeps their seat |

The test suite does not use these — it passes durations straight to
`createIconIoServer()`, so a suite's timing cannot be changed out from under it
by an environment variable.

---

## 5. How to extend it

### Adding a game

The codebase is _shaped_ for multiple games — routes, assets, and the Gamehub
picker all anticipate it — but nothing is abstracted yet. Draw & Guess logic is
hardcoded into event names (`startDrawAndGuessGame`,
`updateDrawAndGuessLobbyRoomList`) and into the single
`drawAndGuessDetailRoomInfoList` object.

To add Minesweeper as-is you'd copy the whole vertical slice. Before doing that
twice, extract the generic part:

1. **Shared types package.** Do this first — it's an hour's work and pays for
   itself immediately. A `shared/` directory referenced by both tsconfigs
   removes a whole class of drift bugs.
2. **Generic room layer** — `Room<TGameState>` with create / join / leave /
   ownership / disconnect, which is identical for every game.
3. **Namespaced events** — `room:join` / `room:leave` with a `gameType`
   discriminator, instead of `clientJoinDrawAndGuessRoomRequest`.
4. **Per-game module** — each game registers `{ id, minPlayers, maxPlayers,
createInitialState, handlers }`. Draw & Guess becomes the first consumer.

### Feature ideas

Several of these got substantially cheaper in this pass, because the two things
they all depended on — a server-owned clock and a replayable drawing — now exist.

| Feature                                          | Notes                                                                                                                                                                                                |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **End the turn early when everyone has guessed** | The engine already tracks `receivedPointsThisTurn` and owns the timer. Count the players who have scored against the players who are not drawing, and call the phase over. Perhaps twenty lines now. |
| **Late-joiner canvas sync**                      | The drawing is a stroke list now. Keep it on the server too and send it with the room snapshot. Also fixes §3.1's blank-canvas bug.                                                                  |
| **Progressive letter hints**                     | Reveal a letter at 60s and 30s. The engine holds the word and the clock, so this is a scheduled callback plus an emit.                                                                               |
| **Time-weighted scoring**                        | Award points on remaining time instead of a flat 100. `getRemainingPhaseMs()` already gives you the number.                                                                                          |
| **Close-guess feedback**                         | "Sam is close!" on Levenshtein distance 1–2. Cheap and fun, and the guess now runs server-side where you'd put it.                                                                                   |
| **Custom word lists**                            | Per-room word packs; the word bank is already a plain record.                                                                                                                                        |
| **Round summary screen**                         | Show per-turn point deltas during the review phase.                                                                                                                                                  |

### Infrastructure

- **Tests — done.** 132 of them: 102 backend across 8 files, 30 frontend across 4. The backend suite runs real socket.io clients against a real server, because
  that is where the interesting behaviour lives; each suite binds its own
  ephemeral port, so no suite can see a room another left behind.
  `createIconIoServer()` exists for this — building the server at module scope
  meant importing it was the same thing as taking a port. Phase durations are a
  parameter of the engine rather than a module constant, so a whole game runs in
  milliseconds.
- **CI — done.** [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs
  lint, typecheck, format, test and build on every pull request. Dependabot is
  already active here, so CI now says whether its PRs are safe to merge.
- **One linter, one formatter — done.** Both are root-level commands over both
  packages. Linting had only ever covered `front/`; extending it to the backend
  immediately found two real errors in a test helper.
- **A shared `docker-compose`** or an npm workspace root, so `npm run dev`
  starts both halves. Right now it's two terminals. (The root `package.json`
  added in this pass is deliberately not a workspace — it carries the shared
  tooling only, and the two applications keep their own dependencies.)

---

## 6. Suggested order of work

1. **Check who is drawing, and who starts the game.** §3.1's first two items.
   Both are a handful of lines against a pattern already in the codebase, and
   they close the last gap between what the UI enforces and what the server
   does. Half an evening, and the regression tests are easy — a client that
   never joined, emitting into a room.
2. **Store the stroke list server-side.** Fixes the blank canvas for joiners and
   for reconnecting players, and is what would let a reloading drawer keep their
   turn instead of losing it. A weekend, and the single biggest improvement to
   how the game feels to a player who arrives mid-turn.
3. **Shared types package.** `front/src/models/types.ts` and
   `back/models/types.ts` are near-identical copies edited in lockstep, and the
   last three passes each added fields to both. The most valuable structural
   change left, and CI will catch it if the extraction goes wrong. An hour.
4. **End the turn early when everyone has guessed.** Small, and the biggest
   improvement to the game's pacing. The engine already has both halves.
5. **Progressive hints and time-weighted scoring.** An evening each.
6. **Rate limiting.** The last unbounded thing a client controls. Payload sizes
   are checked; how often they arrive is not.
7. **Housekeeping**, whenever it's convenient: the dead Minesweeper link, the
   `password-prmopt-modal.tsx` typo, the commented-out `ValidateAuth`, the
   `window.location.reload()`, and the eleven lint warnings.
8. _Then_ consider a second game — on top of an extracted room layer.
