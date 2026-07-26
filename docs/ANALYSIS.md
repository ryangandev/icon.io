# Icon.io — Project Analysis

_Written 2026-07-25 after the dependency modernization pass; updated 2026-07-26
after the bug-fix pass._

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
happens over Socket.io. Server state lives in two module-level objects in
[`back/server.ts`](../back/server.ts):

```ts
let drawAndGuessDetailRoomInfoList: Record<string, DrawAndGuessDetailRoomInfo> =
  {};
let socketInRooms: Record<string, Set<string>> = {};
```

Restarting the server drops every room. For a hobby project that's a perfectly
reasonable trade — it just needs to be a conscious one.

**Handler layout** (`back/socket/draw-and-guess/`):

| File                                  | Responsibility                             |
| ------------------------------------- | ------------------------------------------ |
| `game-engine.ts`                      | The turn state machine and the phase clock |
| `lobby-events-handler.ts`             | List rooms, create room                    |
| `room-events-handler.ts`              | Join / leave, ownership transfer           |
| `game-events-handler.ts`              | Socket glue over the engine                |
| `chat-events-handler.ts`              | Chat messages and guess checking           |
| `whiteboard-canvas-events-handler.ts` | Relay draw / undo / clear events           |
| `../client-disconnect-handler.ts`     | Cleanup on disconnect                      |

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
- **The UI's rules are enforced, not assumed.** Disabling an input is a
  convenience for honest clients; the server re-checks who may guess, who may
  pick a word, and who may speak in a room.

**Identity is still the socket id.** Players are keyed by `socket.id`, so a
refresh or a brief network drop makes you a brand-new player. There are no
accounts; the username lives in `sessionStorage`. Server-authoritative timing is
the prerequisite for fixing that, and it is now in place.

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

### Word bank

6 categories in [`back/libs/word-bank.ts`](../back/libs/word-bank.ts): Fruits,
Animals, League Of Legends, Electronics, Sports, Food.

### Stubs and dead code

- **Minesweeper** — the Gamehub tile links to `/Gamehub/Minesweeper/Lobby`, which
  has no route and lands on the 404 page. Art assets exist; nothing else does.
- **`back/archived/`** — four files from the pre-rewrite version. Nothing imports
  them; they're now excluded from the build. Safe to delete.
- The old `ValidateAuth` implementation is left commented out at the top of
  [`front/src/components/validate-auth.tsx`](../front/src/components/validate-auth.tsx).

---

## 3. Bugs

**Every 🔴, 🟠 and 🟡 issue in the previous revision of this document has been
fixed**, each as its own commit, each verified against a running server rather
than by reading the diff. They are kept below with what the fix was, because the
reasoning is more useful than a changelog line. What is still open is in §3.2.

### 3.1 Fixed

#### 🔴 Room passwords were broadcast in plaintext to everyone

`getDrawAndGuessLobbyRoomInfo()` copied the `password` field into the lobby room
list, and that list is `io.emit`-ed to every connected client. Any client that
opened the lobby received every room's password:

```json
{
  "roomName": "Secret Room",
  "status": "Open",
  "password": "hunter2-SUPERSECRET"
}
```

The frontend only ever used the field as a boolean, to pick a 🔒 or 🔓 icon.

The same class of bug applied to the room payloads: join, leave and game-end all
emitted the internal room object wholesale, so `password` went to everyone in
the room — and so did `currentWord`, the word the others are supposed to be
guessing, on every leave event during a turn.

**Fixed** by introducing explicit wire types and routing every emit through a
builder. The lobby summary carries `hasPassword: boolean`; the room snapshot
drops `password` and omits `currentWord`/`wordChoices` while the word is in play.
They are _omitted_ rather than blanked, so the client's merge does not clobber
the drawer's own copy. The server also no longer echoes the password back to the
room's creator, and no longer logs the room object.

_Verified:_ a snooper joining the lobby receives no password field, sees
`hasPassword: true`, and is rejected when it guesses a room id and tries a wrong
password.

#### 🔴 Game timing was client-authoritative — the room hung if the drawer left

`drawingPhaseTimerEnded` and `reviewingPhaseTimerEnded` were emitted by the
**drawer's browser**. If the drawer closed their tab mid-turn, nobody advanced
the phase and the room was stuck until everyone gave up. The same design let a
modified client end its own drawing phase early, or never.

**Fixed** by extracting [`game-engine.ts`](../back/socket/draw-and-guess/game-engine.ts),
which owns one `setTimeout` per room and drives every transition itself. See §1.
Three distinct ways a room could hang are handled: the drawer leaving, a
departed player still sitting in `drawerQueue` and being dealt a turn nobody
draws, and a game dropping below two players.

On the client this collapsed three timers, three timeout refs and six start-time
refs into one deadline and one hook.

_Verified:_ three headless multi-client runs, none of which emit any phase
event — a full game plays to completion and reopens the room; killing the
drawer's connection mid-turn advances to the next turn and does not deal them
another; dropping to one player ends the game.

#### 🟠 The password prompt rendered once per table row

`<PasswordPromptModal>` was rendered inside the `Action` column's `render()`, so
the table produced one modal per room, all driven by a single shared boolean.
Clicking Join on any locked room opened every locked room's modal at once,
stacked, and whichever landed on top received the submission.

**Fixed** by hoisting one modal out of the table and tracking
`pendingRoom: RoomInfo | null`. It is keyed by room id so each prompt opens
empty, and its title names the room.

_Verified in a browser:_ clicking Join on a locked room produces exactly one
modal, titled `Password for "Alice's Room"`; a wrong password is rejected; the
right one joins; reopening shows an empty field.

#### 🟠 Nothing a client sent was validated

`createDrawAndGuessRoomRequest` trusted its payload wholesale, so `maxPlayers`,
`rounds`, `roomName` and `password` went straight into game state. Chat messages
were unbounded on the wire despite the input capping them at 40 characters, and
every room-scoped event took whatever string it was handed as a room id.

**Fixed** with zod schemas covering all inbound events, bounded to mirror what
the UI already enforces. Invalid events are dropped and logged rather than
answered.

Two things this turned up. The first attempt used `.catch('')` for the optional
password, which substitutes the default on failure — so an over-long password
created a room the requester believed was locked and that was actually open.
And `getRandomChoicesFromList()` loops until it has N _distinct_ indexes, so a
word-bank category with fewer than three entries would have spun forever.

_Verified:_ ten malformed room requests, a burst of room-scoped events with a
non-UUID room id, and a 50KB chat message — nothing created, nothing relayed,
connection still up, legitimate requests unaffected.

#### 🟠 The drawing toolbar sat below the fold at 720p

In a 1280×720 viewport the canvas ran y=120–720 and the toolbar landed at
**y=726**. The drawer had to scroll away from their own canvas to reach a
colour, a brush, undo or clear.

**Fixed** by moving the toolbar above the canvas and sizing the drawing area to
what is left of the window. Because the canvas is no longer displayed at its
bitmap size, mouse positions are now scaled into bitmap space — the two sizes
previously happened to agree to within a couple of pixels, and any change would
have silently skewed every stroke.

_Verified in a 1280×720 viewport with a game in progress:_ toolbar at y=131–182,
canvas ending at y=718, page 11px taller than the viewport rather than 68px.
Dragging puts ink at bitmap x=93–497 against an expected 95–494 — the difference
being exactly the 2px brush radius.

#### 🟡 Undo shipped a full-canvas PNG, per undo

`handleUndo` serialized the previous canvas state to a data URL and emitted it —
100 KB to 1 MB each — while `previousStatesRef` accumulated raw `ImageData`
objects at 798 × 598 × 4 ≈ **1.9 MB each**, unbounded, for the whole turn.

**Fixed** by keeping the drawing as a stroke list. Every client receives the same
draw events, so every client builds the same list, and undo becomes "drop the
last entry and repaint". Colour and size now travel with a stroke's first point
so it is fully described from the start. This also leaves the drawing in a
replayable form, which is what late-joiner sync needs.

_Verified:_ undo relays with a 2-byte payload; an undo carrying a data URL is
rejected rather than forwarded. In two real browsers sharing a room, after two
strokes both canvases hold identical ink (4641 pixels, same bands), and after one
undo the watcher repaints to exactly the surviving stroke.

#### 🟡 A 250 ms `setTimeout` papered over a join race

The join broadcast was wrapped in `setTimeout(..., 250)` "to ensure that the
client has joined the room". `socket.join()` is synchronous on a single node, so
the socket was already a member — what the delay actually covered is that the
joining client is still navigating and has not subscribed yet. That made it a
guess about how long React takes to mount.

**Fixed** by broadcasting immediately and having the room page ask for state once
it has mounted and its listeners are live. The page now reads the room id from
the route rather than waiting to be told it.

_Verified:_ over 25 consecutive joins, state arrived every time, worst case 1 ms
after asking.

#### 🟡 Guess authority was client-side only

`takingAGuess` awarded points without checking anything. A modified client could
award itself 100 points by guessing the word it was drawing, or guess during the
reveal phase when the answer is on screen.

**Fixed** by checking what the UI was merely displaying: sender is in the room,
the drawing phase is running, the sender is not the drawer, and they have not
already scored. `sendMessage` got the membership check too — any socket knowing
a room id could post into a room it had never joined.

_Verified:_ an outsider posting into a room, a guess before the game starts, the
drawer guessing their own word, and one player guessing correctly five times —
none scored. A genuine guesser still scores, case-insensitively.

#### 🟡 `socketInRooms[socket.id]` could be undefined

`socketInRooms[socket.id].delete(roomId)` threw when the socket had no entry.
Inside a `try/catch` it degraded to a spurious `roomError` — but the room had
already been mutated, so the client was told its leave had failed while the room
had in fact lost a player and possibly changed owner.

**Fixed** by guarding the lookup and checking membership before anything is
mutated.

_Verified:_ a socket that never joined announcing a departure leaves the player
count, owner and chat untouched and produces no error; leaving twice removes
exactly one player.

### 3.2 Still open

#### 🟠 A refresh or a deep link bounces you to the Gamehub

[`require-socket.tsx`](../front/src/components/require-socket.tsx) redirects to
`/Gamehub` when `socket.connected` is false at first render — which it always is
on a fresh page load, because the connection has not been established yet. So
pasting a room URL, or refreshing while in a room, never lands where you meant.

**Fix:** render a "connecting…" state instead of redirecting, and only redirect
once the connection has actually failed. This was found while testing the fixes
above; it is a real UX bug and small to fix.

#### 🟢 Smaller things

- No rate limiting on any socket event. Payloads are bounded now, but their
  frequency is not.
- The word hint never progressively reveals letters.
- `validate-auth.tsx` calls `window.location.reload()` after setting a username.
- Filename typo: `password-prmopt-modal.tsx`.
- Still zero tests in the repo. The integration suites written for this pass ran
  against a live server and are not committed — see §5.

### 3.3 Fixed during the earlier modernization pass

- `reviewingPhaseTimeoutId` was never cleared on unmount, so the reviewing-phase
  timer fired after you left the room. (The refs it lived in are gone entirely
  now.)
- `currentRoomInfo.playerList[socket.id]` indexed with a possibly `undefined` id.
- `getRandomElementFromSet` could return `undefined` and was typed `string`.
- `wordCategory` was typed `string` and used to index a `WordCategory`-keyed
  record — invisible because `noImplicitAny` was off.
- `app.get('/*')` — invalid in Express 5, now `'/{*splat}'`.
- `back/build/` was committed to git; now ignored and untracked.
- `@ant-design/icons` was imported but never declared as a dependency.

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
| Lint             | CRA built-in (eslint 8)               | **oxlint**                |
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
- **oxlint instead of ESLint.** `typescript-eslint` hard-refuses TypeScript 7
  (it errors out on load; support is tracked for TS ≥ 7.1 in
  typescript-eslint#10940), and the suggested workaround needs a TypeScript 6.0
  that is still only a beta. oxlint parses TS/TSX natively in Rust with no
  TypeScript API dependency, so it sidesteps the conflict entirely. **If you'd
  rather be back on ESLint, that's the trade to revisit** once typescript-eslint
  ships TS 7 support.
- **Dropped 12 unused dependencies**: `argon2`, `axios` (both sides),
  `cookie-parser`, `zod`, `jest`, `ts-jest`, `ts-node`, `web-vitals`,
  `react-icons`, and all three `@testing-library/*` packages. None were imported
  anywhere. `uuid` was replaced by the built-in `crypto.randomUUID()`.
  (`zod` has since come back, and is now actually used — see §3.1.)
- **Stricter TypeScript.** `noImplicitAny` was off; turning it on surfaced four
  real type holes. `verbatimModuleSyntax` and `noUnusedLocals` are now on too.

### New server settings

The server owns the game clock, so phase lengths are server-side settings.
Shorten them to play a whole game through in seconds while developing:

| Variable              | Default | Purpose                                 |
| --------------------- | ------- | --------------------------------------- |
| `WORD_SELECT_SECONDS` | `15`    | How long the drawer has to pick a word  |
| `DRAWING_SECONDS`     | `90`    | Length of the drawing phase             |
| `REVIEW_SECONDS`      | `10`    | How long the word is shown after a turn |

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

1. **Generic room layer** — `Room<TGameState>` with create / join / leave /
   ownership / disconnect, which is identical for every game.
2. **Namespaced events** — `room:join` / `room:leave` with a `gameType`
   discriminator, instead of `clientJoinDrawAndGuessRoomRequest`.
3. **Per-game module** — each game registers `{ id, minPlayers, maxPlayers,
createInitialState, handlers }`. Draw & Guess becomes the first consumer.
4. **Shared types package.** `front/src/models/types.ts` and
   `back/models/types.ts` are currently **byte-identical copies** that must be
   edited in lockstep. A `shared/` directory referenced by both tsconfigs
   removes a whole class of drift bugs. Do this first — it's an hour's work and
   pays for itself immediately.

### Highest-value features

Several of these got substantially cheaper in this pass, because the two things
they all depended on — a server-owned clock and a replayable drawing — now exist.

| Feature                                          | Notes                                                                                                                                                                                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **End the turn early when everyone has guessed** | The engine already tracks `receivedPointsThisTurn` and owns the timer. Count the players who have scored against the players who are not drawing, and call the phase over. Perhaps twenty lines now.                                                                |
| **Reconnection**                                 | The blocker was client-authoritative timing; that is gone. Issue a persistent player id, keep the seat alive for ~30s, and re-send the room snapshot on return — the mechanism for that already exists as `requestDrawAndGuessRoomState`. Biggest UX win available. |
| **Late-joiner canvas sync**                      | The drawing is a stroke list now. Keep it on the server too and send it with the room snapshot.                                                                                                                                                                     |
| **Progressive letter hints**                     | Reveal a letter at 60s and 30s. The engine holds the word and the clock, so this is a scheduled callback plus an emit.                                                                                                                                              |
| **Time-weighted scoring**                        | Award points on remaining time instead of a flat 100. `getRemainingPhaseMs()` already gives you the number.                                                                                                                                                         |
| **Close-guess feedback**                         | "Sam is close!" on Levenshtein distance 1–2. Cheap and fun, and the guess now runs server-side where you'd put it.                                                                                                                                                  |
| **Custom word lists**                            | Per-room word packs; the word bank is already a plain record.                                                                                                                                                                                                       |
| **Round summary screen**                         | Show per-turn point deltas during the review phase.                                                                                                                                                                                                                 |

### Infrastructure worth having

- **Tests.** Still none in the repo, and this is now the most valuable gap. Every
  fix in §3.1 was verified by an integration script that drove real socket.io
  clients against a running server — full game flow, drawer departure, malformed
  payloads, guess cheating, join timing, canvas relay. Those scripts were
  throwaway; committing their successors as a Vitest suite would turn a one-off
  verification into a regression net. `back/libs/utils.ts` and the scoring logic
  are pure and unit-testable; the engine is best tested exactly as it was here,
  by talking to it over a socket.
- **CI.** A GitHub Action running `typecheck` + `lint` + `build` on both
  packages. Dependabot is already active on this repo; CI would tell you whether
  its PRs are safe to merge.
- **A Prettier config.** `front/package.json` has a `format` script but the repo
  has no config file, so running it would reformat every file away from the
  4-space, single-quote style the code is actually written in.
- **A shared `docker-compose`** or an npm workspace root, so `npm run dev`
  starts both halves. Right now it's two terminals.

---

## 6. Suggested order of work

Items 2–6 of the previous list are done. What remains, reordered around what is
now true:

1. **Tests, then CI.** This moved to the front. Nine behavioural fixes just
   landed and nothing in the repo would catch a regression in any of them. Start
   with the integration shape used to verify them — real clients against a real
   server — because that is where the interesting behaviour lives. Then a GitHub
   Action running `typecheck` + `lint` + `build` on both packages.
2. **Shared types package.** `front/src/models/types.ts` and
   `back/models/types.ts` are near-identical copies that must be edited in
   lockstep, and this pass added fields to both. A `shared/` directory referenced
   by both tsconfigs removes a whole class of drift bugs.
3. **Fix the deep-link/refresh redirect** (§3.2). Small, and it is the most
   visible remaining rough edge.
4. **End the turn early when everyone has guessed.** Small, and the single
   biggest improvement to how the game actually feels to play.
5. **Reconnection.** Now unblocked. A weekend.
6. **Late-joiner canvas sync.** Cheap once the stroke list lives server-side.
7. **Progressive hints and time-weighted scoring.** An evening each, and the
   engine gives you everything both need.
8. _Then_ consider a second game — on top of an extracted room layer.

Items 1–4 are each an evening. Items 5–6 are a weekend apiece.
