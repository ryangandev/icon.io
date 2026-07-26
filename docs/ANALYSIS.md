# Icon.io — Project Analysis

_Written 2026-07-25, after the dependency modernization pass._

This is a snapshot of what the project does today, what's broken, and what it
would take to grow it into an ongoing hobby project. Roughly 5,000 lines of
TypeScript across `front/` (React SPA) and `back/` (Express + Socket.io).

---

## 1. Architecture in one page

```
front/  React SPA ──── socket.io ────► back/  Express + Socket.io
                                            │
                                            └── all game state in memory
                                                (two plain objects)
```

**There is no database and no HTTP API.** Everything except serving static files
happens over Socket.io. Server state lives in two module-level objects in
[`back/server.ts`](../back/server.ts):

```ts
let drawAndGuessDetailRoomInfoList: Record<string, DrawAndGuessDetailRoomInfo> = {};
let socketInRooms: Record<string, Set<string>> = {};
```

Restarting the server drops every room. For a hobby project that's a perfectly
reasonable trade — it just needs to be a conscious one.

**Handler layout** (`back/socket/draw-and-guess/`):

| File                                  | Responsibility                                    |
| ------------------------------------- | ------------------------------------------------- |
| `lobby-events-handler.ts`             | List rooms, create room                           |
| `room-events-handler.ts`              | Join / leave, ownership transfer                  |
| `game-events-handler.ts`              | Start game, phase transitions, drawer rotation    |
| `chat-events-handler.ts`              | Chat messages and guess checking                  |
| `whiteboard-canvas-events-handler.ts` | Relay draw / undo / clear events                  |
| `../client-disconnect-handler.ts`     | Cleanup on disconnect                             |

**Identity is the socket id.** Players are keyed by `socket.id`, so a refresh or
a brief network drop makes you a brand-new player. There are no accounts; the
username lives in `sessionStorage`.

---

## 2. What's actually built

### Working end to end

Verified by playing a full two-player game against a production build.

- **Landing → username** stored in `sessionStorage`, gated by `ValidateAuth`.
- **Gamehub** with a game picker.
- **Lobby**: live-updating room table, create room (name, 2–8 players, 1–4
  rounds, optional password), join, password prompt.
- **Room**: live player list with ranking, points, owner crown, drawer pencil.
- **Game loop**: owner starts (min 2 players) → one random word category per
  game → each round every player draws once, in random order. Per turn:
  - **Word select**, 15s — drawer picks from 3 words; auto-picks the first on timeout.
  - **Drawing**, 90s — drawer draws, everyone else sees `_ _ _ _` length hints.
  - **Review**, 10s — the word is revealed.
- **Whiteboard**: freehand drawing, colour picker, 4 brush sizes, undo, clear,
  all broadcast to the room.
- **Chat**: doubles as the guess channel during the drawing phase. A correct
  guess awards **+100** to the guesser and **+40** to the drawer, once per turn.
  Matching is case-insensitive. The drawer's input is disabled, as is yours once
  you've guessed correctly.
- **Disconnects**: player removed, ownership transferred, empty rooms deleted.

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

Ordered by severity. Items marked **[fixed]** were fixed during the
modernization pass; everything else is still open.

### 🔴 Room passwords are broadcast in plaintext to everyone

**The most serious issue in the codebase.**
[`getDrawAndGuessLobbyRoomInfo()`](../back/libs/utils.ts) copies the `password`
field into the lobby room list, and that list is `io.emit`-ed to every connected
client. Any client that opens the lobby receives every room's password.

Confirmed by connecting a bare Socket.io client and reading the payload:

```json
{
  "roomName": "Secret Room",
  "status": "Open",
  "password": "hunter2-SUPERSECRET"
}
```

The frontend only ever uses this field as a boolean, to pick a 🔒 or 🔓 icon.

**Fix:** send `hasPassword: boolean` instead of `password`, and compare the
submitted password server-side. Hash it with `argon2` while you're in there —
that dependency was already in `package.json`, unused, which suggests it was the
original plan.

### 🔴 Game timing is client-authoritative — the game hangs if the drawer leaves

`drawingPhaseTimerEnded` and `reviewingPhaseTimerEnded` are emitted by the
**drawer's browser** ([`draw-and-guess-room.tsx`](../front/src/pages/rooms/draw-and-guess-room.tsx)).
If the drawer closes their tab mid-turn, nobody advances the phase and the room
is stuck until everyone leaves. There's an acknowledging `TODO` in
[`room-events-handler.ts`](../back/socket/draw-and-guess/room-events-handler.ts).

The same design lets a modified client end its own drawing phase early, or never.

**Fix:** own the phase clock on the server with `setTimeout` per room, and treat
client timer events as advisory at most. This is the single highest-value
refactor in the project — it also unblocks reconnection.

### 🟠 The password prompt renders once per table row

In [`draw-and-guess-lobby.tsx`](../front/src/pages/lobbies/draw-and-guess-lobby.tsx),
`<PasswordPromptModal>` is rendered inside the `Action` column's `render()`, so
there's one modal per room, all driven by a single shared `passwordPromptOpen`
state. Clicking Join on any locked room opens every locked room's modal at once,
stacked. Submitting hits whichever one is on top.

**Fix:** hoist a single modal out of the table and track
`pendingRoom: RoomInfo | null`.

### 🟠 No server-side validation of anything a client sends

`createDrawAndGuessRoomRequest` trusts the payload wholesale — `maxPlayers`,
`rounds`, `roomName`, and `password` go straight into game state with no bounds
or length checks. A crafted client can create a room with `maxPlayers: 1e9` or a
megabyte-long name. Chat messages are likewise unbounded server-side (the client
caps at 40 chars). `zod` was a dependency but was never imported.

**Fix:** a `zod` schema per inbound event. It's about 30 lines total.

### 🟠 The drawing toolbar sits below the fold at 720p

Measured in a 1280×720 viewport: the canvas occupies y=120–720 and the toolbar
lands at **y=726**. The drawer has to scroll to reach colours, brush sizes, undo,
and clear. The canvas is hardcoded to `width={798} height={598}` with no
responsive handling.

**Fix:** make the canvas box-sized to its container and move the toolbar above
the canvas, or overlay it.

### 🟡 Undo ships a full-canvas PNG over the socket, per undo

[`handleUndo`](../front/src/components/whiteboard-canvas.tsx) serializes the
previous canvas state to a data URL and emits it. That's on the order of
100 KB – 1 MB per undo. Separately, `previousStatesRef` accumulates raw
`ImageData` objects — 798 × 598 × 4 ≈ **1.9 MB each**, unbounded, for the whole
turn.

**Fix:** keep a stroke list rather than bitmaps and replay it; broadcast
"remove last stroke". Cheaper on both network and memory, and it makes
late-joiner canvas sync possible.

### 🟡 A 250 ms `setTimeout` papers over a join race

`room-events-handler.ts` delays the `clientJoinDrawAndGuessRoomSuccess`
broadcast by 250 ms "to ensure that the client has joined the room". On a slow
connection this is a coin flip; `socket.join()` is synchronous in a
single-node setup, so the delay is likely unnecessary — and if it isn't, the
right fix is an acknowledgement callback.

### 🟡 Guess authority is client-side only

`takingAGuess` never verifies server-side that the sender isn't the current
drawer, or that the drawing phase is actually active. The UI disables the input;
a modified client isn't bound by that.

### 🟡 `socketInRooms[socket.id]` can be undefined

In the leave handler, `socketInRooms[socket.id].delete(roomId)` throws if the
socket has no entry. It's inside a `try/catch`, so it degrades to a spurious
`roomError` rather than a crash — but the room state has already been mutated by
that point.

### 🟢 Smaller things

- No rate limiting on any socket event.
- The word hint never progressively reveals letters.
- `validate-auth.tsx` calls `window.location.reload()` after setting a username.
- Filename typo: `password-prmopt-modal.tsx`.
- Variable typo: `currenRoom` in `chat-events-handler.ts`.
- Zero tests. `jest` and `ts-jest` were dependencies but no test file ever existed.

### Fixed during this pass

- **[fixed]** `reviewingPhaseTimeoutId` was never cleared on unmount, so the
  reviewing-phase timer fired after you left the room.
- **[fixed]** `currentRoomInfo.playerList[socket.id]` indexed with a possibly
  `undefined` id (socket.io types `id` as `string | undefined` before connect).
- **[fixed]** `getRandomElementFromSet` could return `undefined` and was typed
  `string`; callers now guard.
- **[fixed]** `wordCategory` was typed `string` and used to index a
  `WordCategory`-keyed record — invisible because `noImplicitAny` was off.
- **[fixed]** `app.get('/*')` — invalid in Express 5, now `'/{*splat}'`.
- **[fixed]** `back/build/` was committed to git; now ignored and untracked.
- **[fixed]** `@ant-design/icons` was imported but never declared as a
  dependency; it only resolved as a transitive of `antd`.

---

## 4. Modernization: what changed

| | Before | After |
| --- | --- | --- |
| Build (front) | react-scripts 5.0.1 (CRA, deprecated) | **Vite 8** |
| React | 18.2 | **19.2** |
| Ant Design | 5.9 | **6.5** |
| Router | react-router-dom 6.8 | **react-router 8.3** |
| TypeScript | 4.9 | **7.0** |
| Express | 4.19 | **5.2** |
| Socket.io | 4.7 | **4.8** |
| Lint | CRA built-in (eslint 8) | **oxlint** |
| Node | 18 types | **20+**, `@types/node` 26 |
| Frontend install | ~1,500 packages | **106** |
| Backend install | ~800 packages | **129** |
| Prod build time | ~30 s | **~0.8 s** |
| `npm audit` | 2 high (react-router CSRF) | **0** |

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
- **Stricter TypeScript.** `noImplicitAny` was off; turning it on surfaced four
  real type holes. `verbatimModuleSyntax` and `noUnusedLocals` are now on too.

---

## 5. How to extend it

### Adding a game

The codebase is *shaped* for multiple games — routes, assets, and the Gamehub
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

| Feature | Notes |
| --- | --- |
| **Reconnection** | Depends on server-authoritative timers. Issue a persistent player id, keep the seat alive for ~30s. Biggest UX win available. |
| **Late-joiner canvas sync** | Falls out almost free once drawing is a replayable stroke list rather than bitmaps. |
| **Progressive letter hints** | Reveal a letter at 60s and 30s. Small change in `game-events-handler.ts`, big gameplay improvement. |
| **Close-guess feedback** | "Sam is close!" on Levenshtein distance 1–2. Cheap and fun. |
| **Time-weighted scoring** | Award points on remaining time instead of a flat 100. One-line change with real gameplay impact. |
| **Custom word lists** | Per-room word packs; the word bank is already a plain record. |
| **Round summary screen** | Show per-turn point deltas during the 10s review phase. |

### Infrastructure worth having

- **Tests.** There are none. `back/libs/utils.ts` and the scoring logic in
  `chat-events-handler.ts` are pure and trivially testable — start there with
  Vitest (it shares Vite's config).
- **CI.** A GitHub Action running `typecheck` + `lint` + `build` on both
  packages. Dependabot is already active on this repo; CI would tell you whether
  its PRs are safe to merge.
- **A shared `docker-compose`** or an npm workspace root, so `npm run dev`
  starts both halves. Right now it's two terminals.

---

## 6. Suggested order of work

1. **Shared types package.** Everything else is easier afterwards.
2. **Fix the password leak.** Small, self-contained, and it's a real
   vulnerability on a deployed site.
3. **Move phase timers to the server.** The keystone refactor — fixes the
   drawer-leaves hang and unblocks reconnection.
4. **Zod-validate inbound events.** ~30 lines, closes the whole
   malformed-input class.
5. **Fix the lobby modal-per-row bug and the toolbar layout.** Quick, visible.
6. **Strokes instead of bitmaps.** Fixes the undo bandwidth and memory problems,
   enables late-joiner sync.
7. **Reconnection.**
8. **Vitest on the pure logic**, then CI.
9. *Then* consider a second game — on top of the extracted room layer.

Items 1–5 are each an evening. Items 6–7 are a weekend apiece.
