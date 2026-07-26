# Icon.io — Project Analysis

_Written 2026-07-25 after the dependency modernization pass; updated 2026-07-26
after the bug-fix, reconnection and enhancement passes._

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

| File                                  | Responsibility                                  |
| ------------------------------------- | ----------------------------------------------- |
| `game-engine.ts`                      | The turn state machine and the phase clock      |
| `lobby-events-handler.ts`             | List rooms, create room                         |
| `room-events-handler.ts`              | Join / leave, ownership transfer                |
| `game-events-handler.ts`              | Socket glue over the engine                     |
| `chat-events-handler.ts`              | Chat messages and guess checking                |
| `whiteboard-canvas-events-handler.ts` | Relay draw / undo / clear events                |
| `canvas.ts`                           | The room's drawing, as a replayable stroke list |
| `membership.ts`                       | Seats, departures and the reconnect grace       |
| `../player-session-handler.ts`        | The identity handshake                          |
| `../client-disconnect-handler.ts`     | Hands a dropped socket to `membership.ts`       |

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
  before it reaches game state, and **rate-limited**
  ([`back/libs/rate-limit.ts`](../back/libs/rate-limit.ts)) before that — one
  token bucket per kind of event, per socket, because a drawing phase is a
  stream of coordinates and joining a room is a click.
- **The UI's rules are enforced, not assumed.** Only the drawer may draw, and
  only during a drawing phase; only the owner may start a game; only a
  seat-holder may read a room's state. None of those were checked before the
  enhancement pass — every one of them was reachable with a room id off the
  lobby broadcast, which every connected client receives.
- **The drawing is server state too.** The same stroke list every client builds
  from the same events is built once more on the server, so a player arriving
  mid-turn is sent the board rather than a blank one.

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

A drawer's _turn_ is held too, but only for ten seconds and only once the
drawing has started: long enough for a refresh, short enough that a room whose
drawer has actually gone is not left watching a frozen canvas. They come back to
the same board, the same word and the same clock.

**One definition of every shape that crosses the socket.**
[`shared/wire-types.d.ts`](../shared/wire-types.d.ts) is imported by both
packages. The two `models/types.ts` files used to be near-identical copies
edited in lockstep, and had already drifted — the client declared `currentWord`
as required where the server omits it, and its `ErrorType` was a member behind.
Types only, imported with `import type`, so nothing resolves at runtime.

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
- **Game loop**: the owner starts (min 2 players) → one random word category per
  game → each round every player draws once, in random order. Every phase
  boundary below is decided by the server. Per turn:
  - **Word select**, 15s — the drawer picks from 3 words; the server picks the
    first on timeout, whether or not the drawer's browser is still there.
  - **Drawing**, 90s — the drawer draws; everyone else sees a length hint that
    gives up a third of its letters as the clock runs down. Ends early the
    moment everybody has guessed.
  - **Review**, 10s — the word is revealed.
- **Whiteboard**: freehand drawing, colour picker, 4 brush sizes, undo, clear,
  all broadcast to the room as strokes — and kept server-side, so a player
  arriving mid-turn is sent the drawing so far.
- **Chat**: doubles as the guess channel during the drawing phase. A correct
  guess is worth 50 for getting there at all plus up to 100 more for how much
  of the phase is left, and the drawer takes two fifths of whatever the guesser
  earned. Once per turn. Matching is case-insensitive. The drawer cannot guess
  and neither can anyone who has already scored — enforced server-side, not
  just in the UI.
- **Departures**: player removed, ownership transferred, empty rooms deleted. If
  the player who left was drawing, the turn is skipped; if the room drops below
  two players mid-game, the game ends rather than stalling.
- **Reconnection**: a reload keeps your seat, your score, the crown and your
  place in the round, and — if you were drawing — your turn, your word and your
  drawing. Others see you marked away rather than gone.

### Word bank

6 categories in [`back/libs/word-bank.ts`](../back/libs/word-bank.ts): Fruits,
Animals, League Of Legends, Electronics, Sports, Food.

### Stubs and dead code

- **Minesweeper** — art assets and a Gamehub tile exist; nothing else does. The
  tile no longer links anywhere, having previously pointed at a route that does
  not exist.

---

## 3. Bugs

Everything this document has ever listed as 🔴, 🟠 or 🟡 is fixed, each as its
own commit, each verified against a running server rather than by reading the
diff — see §3.2 for the index. §3.1 is what is still open.

### 3.1 Open

#### 🟢 A new player cannot join a game in progress

By design rather than by accident, but worth stating because it is the first
thing a second visitor tries: a room's status goes to `In Progress` when the
game starts, and joining is refused until it ends. The room page's own arrival
paths — a reload, a re-mount, a pasted link into a waiting room — all work.
Letting a latecomer in as a spectator, or as a player from the next round,
would be a feature rather than a fix.

#### 🟢 A drawer who vanishes freezes the canvas for up to ten seconds

The other side of holding a turn open for a reload. A drawer who closes their
tab mid-drawing leaves the room watching a canvas nobody is drawing on until
the hold expires and the turn is skipped. Ten seconds is the deliberate bound
(`DRAWER_HOLD_SECONDS`); the alternative — skipping instantly, as before — cost
every reloading drawer their turn.

#### 🟢 Smaller things

- **The word bank is small and fixed.** Six categories, no per-room choice, and
  a short game can repeat a word.
- **No round summary.** Points change in the player list and that is all the
  feedback a turn gives; there is nothing showing what each player scored.
- **Canvas rendering is the one thing the suite does not cover**: jsdom has no
  2D context. The relay protocol and the stored stroke list are covered, and
  the drawing itself was verified in a browser when it landed.
- **`front/src/models/error.ts` is now a two-line re-export** of the shared
  contract, which is either tidy or one file too many depending on taste.

### 3.2 Fixed

The reasoning behind each of these is in its commit message and in the pull
request it landed in ([#22](https://github.com/ryangandev/icon.io/pull/22),
[#23](https://github.com/ryangandev/icon.io/pull/23)). Every one is covered by
the committed suite: the ten from the bug-fix pass were checked by reverting
each in turn and confirming the suite catches it, reconnection has 19 tests of
its own, and the three authority holes below were each confirmed to fail their
new test with the check removed.

| Was                                                           | Now                                                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 🔴 Room passwords broadcast in plaintext to every client      | Wire types: the lobby carries `hasPassword`, the room snapshot drops the password                 |
| 🔴 The live word leaked in every leave event during a turn    | `currentWord`/`wordChoices` are _omitted_, not blanked, so the drawer's own copy survives a merge |
| 🔴 Phase timing came from the drawer's browser                | `game-engine.ts` owns one `setTimeout` per room and drives every transition                       |
| 🟠 Anyone could draw on, undo or wipe any room's canvas       | The relay checks the sender holds a seat, is the drawer, and that a drawing phase is running      |
| 🟠 Anyone could start any room's game                         | `startGame` checks the asker against `room.owner.playerId`, before it reports anything else       |
| 🟠 Arriving mid-turn showed a blank canvas                    | The stroke list is server state, and is sent to whoever asks for the room's state                 |
| 🟠 A non-member could read a locked room's player list        | `requestDrawAndGuessRoomState` answers seat-holders; others are told to ask for a seat            |
| 🟠 The password prompt rendered once per table row            | One modal hoisted out of the table, keyed by room id                                              |
| 🟠 Nothing a client sent was validated                        | zod schemas over every inbound event; invalid events dropped and logged                           |
| 🟠 Nothing bounded how _often_ a client sent it               | Token buckets per socket, per kind of event, in a `socket.use` middleware                         |
| 🟠 The drawing toolbar sat below the fold at 720p             | Toolbar above the canvas; mouse positions scaled into bitmap space                                |
| 🟠 A refresh or a deep link bounced you to the Gamehub        | The guard opens the connection instead of redirecting; it redirects only on real failure          |
| 🟠 A reload made you a different person                       | Server-issued player id + token, and a thirty-second seat hold                                    |
| 🟠 A reloading drawer lost their turn                         | The turn is held for ten seconds, and the board, word and clock are still there when they return  |
| 🟡 Undo shipped a full-canvas PNG, per undo                   | A stroke list every client replays; undo is "drop the last entry"                                 |
| 🟡 A 250 ms `setTimeout` papered over a join race             | The room page asks for state once its listeners are live                                          |
| 🟡 Guess authority was client-side only                       | Sender is checked for membership, phase, not-the-drawer, and not-already-scored                   |
| 🟡 `socketInRooms[socket.id]` could be undefined              | Guarded, and membership checked before anything is mutated                                        |
| 🟡 Setting a username reloaded the whole SPA                  | The gate holds the page back until there is a name, so nothing needs telling the name arrived     |
| 🟡 The Minesweeper tile linked to a route that does not exist | A game with nowhere to go is not rendered as a link                                               |
| 🟡 Two hand-maintained copies of every wire type              | `shared/wire-types.d.ts`, imported by both packages                                               |

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
| Tests            | none                                  | **171** (Vitest)          |
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

| Variable                  | Default | Purpose                                        |
| ------------------------- | ------- | ---------------------------------------------- |
| `WORD_SELECT_SECONDS`     | `15`    | How long the drawer has to pick a word         |
| `DRAWING_SECONDS`         | `90`    | Length of the drawing phase                    |
| `REVIEW_SECONDS`          | `10`    | How long the word is shown after a turn        |
| `RECONNECT_GRACE_SECONDS` | `30`    | How long a dropped player keeps their seat     |
| `DRAWER_HOLD_SECONDS`     | `10`    | How long a turn waits for a drawer who dropped |

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

1. ~~**Shared types package.**~~ Done: `shared/wire-types.d.ts`, imported by
   both packages. It is types only — a shared _value_, an event-name constant
   say, would need this to become a real package.
2. **Generic room layer** — `Room<TGameState>` with create / join / leave /
   ownership / disconnect, which is identical for every game.
3. **Namespaced events** — `room:join` / `room:leave` with a `gameType`
   discriminator, instead of `clientJoinDrawAndGuessRoomRequest`.
4. **Per-game module** — each game registers `{ id, minPlayers, maxPlayers,
createInitialState, handlers }`. Draw & Guess becomes the first consumer.

### Feature ideas

The four the last pass listed as cheap were cheap, and are done — a
server-owned clock and a replayable drawing were what they all waited on. What
is left:

| Feature                  | Notes                                                                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Close-guess feedback** | "Sam is close!" on Levenshtein distance 1–2. Cheap and fun, and the guess runs server-side where you would put it.                                        |
| **Custom word lists**    | Per-room word packs; the word bank is already a plain record, and its categories are now named in the shared contract.                                    |
| **Round summary screen** | Per-turn point deltas during the review phase. The engine knows what it awarded and to whom; nothing shows it.                                            |
| **Spectators**           | A room in progress turns newcomers away. The canvas is server state now, so showing them the game without seating them is mostly a matter of deciding to. |
| **A longer word bank**   | Six categories, and a short game can repeat a word inside one turn's choices.                                                                             |

Done this pass: ending the turn early when everybody has guessed, syncing the
canvas to whoever arrives, progressive letter hints, and time-weighted scoring.

### Infrastructure

- **Tests — done.** 171 of them: 137 backend across 10 files, 34 frontend across 5. The backend suite runs real socket.io clients against a real server, because
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

The list this section carried is done — all seven items, one commit each:

1. ~~Check who is drawing, who starts the game, and who may read a room.~~
2. ~~Store the stroke list server-side.~~ Which also gave a reloading drawer
   their turn back.
3. ~~Shared types.~~
4. ~~End the turn early when everyone has guessed.~~
5. ~~Progressive hints and time-weighted scoring.~~
6. ~~Rate limiting.~~
7. ~~Housekeeping.~~ Zero lint warnings, from eleven.

What that leaves, in the order it is worth doing:

1. **A second game, on an extracted room layer.** Steps 2–4 of §5 — a generic
   `Room<TGameState>`, namespaced events, and a per-game module — with
   Minesweeper as the second consumer. Draw & Guess is the reference
   implementation and every piece of it that is _not_ about drawing (seats,
   ownership, the reconnect grace, the lobby) is what wants extracting. Do the
   extraction and the new game together: an abstraction with one consumer is a
   guess, and the second consumer is what tells you whether the guess was right.
2. **Spectators, or letting a latecomer in for the next round.** The first thing
   a second visitor to a running room tries, and the canvas being server state
   now makes it mostly a UI decision.
3. **A round summary and close-guess feedback.** Both are about telling players
   what just happened; the server already knows and does not say.
4. **A longer word bank, and per-room word packs.**
