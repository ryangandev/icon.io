# Zumpo

Little browser games, on your own or in real-time rooms (Draw & Guess, Minesweeper, Make 24, Pairs): a React SPA in `front/`, an Express + Socket.IO server in `back/`, shared wire types in `shared/`, all room state in server memory.
It is being redesigned on the `rework` branch; [docs/status.md](docs/status.md) says where that stands.

Find anything else through [docs/README.md](docs/README.md), and read only the section it points to.

## Commands

| Command                                                      | What it does                                                    |
| ------------------------------------------------------------ | --------------------------------------------------------------- |
| `npm ci && npm run install:all`                              | Install root tooling, then `back/` and `front/` (own lockfiles) |
| `npm run verify`                                             | Lint, typecheck, format check, tests, build: what CI runs       |
| `npm run e2e`                                                | Build, then play the main flows with two players in Chromium    |
| `npm run design:compare`                                     | Build, then capture every Figma screen's state for side by side |
| `npm --prefix back run watch` / `npm --prefix front run dev` | Dev servers on 3000 / 3001                                      |
| `npm run design:import`                                      | Unpack the newest Figma export into `design/figma/`             |
| `npm run design:export`                                      | Export the Figma file through the bridge and import it          |
| `npm run design:tokens`                                      | Regenerate `front/src/ui/generated/` from the export            |
| `npm run figma:run -- script.js`                             | Run a Plugin API script in Figma through the bridge             |

## Rules that fail silently

- The server is authoritative: clocks, scoring and permissions live in `back/`, and the client never advances a phase ([why](docs/architecture.md#server-authority)).
- Rooms reach clients only through a module's `toLobbyInfo` / `toRoomState`, and `room:state` only through `rooms.emitState`, which builds each player's own view; never emit an internal room object or a room-wide snapshot, or secrets leak ([why](docs/architecture.md#server-authority)).
- Every event name and payload is declared once in `shared/wire-types.d.ts`; change both sides through it ([why](docs/architecture.md#the-wire-contract)).
- `socket.off(event)` without a handler removes every listener, including the session's own `session:ready` handler; always pass the handler ([why](docs/architecture.md#pitfalls)).
- `docs/games/` is the behaviour contract for each game; UI work must not change a rule or timing by accident ([design](docs/design.md#what-the-screens-are-and-are-not)).
- Figma is the design source of truth and `design/figma/` and `front/src/ui/generated/` are generated from it; never hand-edit either ([why](docs/design.md#figma-export)).
- Zumpo UI takes every colour, size, font and shadow from the generated `--zumpo-*` tokens; a value missing there is added in Figma, not typed into CSS ([design system](docs/design.md#in-code)).
- Backend tests bind real localhost ports; a sandbox that forbids listening makes them time out, which is not a test failure ([testing](docs/architecture.md#testing)).
- Verify UI and flow changes in a real browser with two players, not just with the suites ([why](docs/architecture.md#testing)).
