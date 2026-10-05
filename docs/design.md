# Design

The Zumpo brand, the Figma file that is the design's source of truth, and how the design gets into this repository.

## Brand and direction

The product is named **Zumpo**: short, abstract, easy to say and share.
The visual direction is **Paper Pop**: cream paper surfaces, ink text, and soft coral, lime, blue and peach accents, set in Nunito Sans Black for display and DM Sans for everything else.
Two other explored directions, Club Circuit and Pocket Studio, are kept in the Figma file's Archive section for reference and are not in use.

Exact colours, type sizes and spacing are tokens in the Figma file, exported to `design/figma/tokens/`.
They are not copied here, so there is one place to change them.

## The Figma file

[Zumpo · Paper Pop flows](https://www.figma.com/design/pd5Hgp7zbT2cMqQNan35uY?node-id=9-14702), file key `pd5Hgp7zbT2cMqQNan35uY`, one page.

| Section                              | Id         | Contents                                              |
| ------------------------------------ | ---------- | ----------------------------------------------------- |
| 00 / Review guide & flow map         | `9:14700`  | Review order, the real rules, which UX is new         |
| 01 / Platform & shared flows         | `9:431`    | P01-P18, desktop                                      |
| 02 / Draw & Guess / complete flow    | `9:866`    | DL01-DL11 lobby, D01-D15 room, desktop                |
| 03 / Minesweeper / complete flow     | `9:2526`   | ML01-ML10 lobby, M01-M16 room, MS01-MS05 solo         |
| 04 / Mobile / 390px flow adaptations | `9:10060`  | MO01-MO18, the main flows at 390 px                   |
| 05 / Make 24 / complete flow         | `40:60741` | T01-T05 solo, T06-T10 room, T11-T12 phone             |
| 06 / Pairs / complete flow           | `40:60743` | PR01-PR04 solo, PR05-PR08 room, PR09-PR10 phone       |
| 07 / Trios / complete flow           | `43:61070` | TS01-TS04 solo, TS05-TS10 room, TS11-TS12 phone       |
| 08 / Liar's Dice / complete flow     | `43:61071` | LD01-LD06 solo, LD07-LD12 room, LD13-LD15 phone       |
| 09 / Hush / complete flow            | `43:61072` | HU01-HU09 room, HU10-HU11 phone                       |
| 10 / Daily Word / complete flow      | `43:61073` | DW01-DW06 solo, DW07-DW11 room, DW12-DW14 phone       |
| Shared pieces                        | `9:198`    | Component families, all named `Zumpo/…`               |
| Archive                              | `9:197`    | Club Circuit and Pocket Studio, with their components |

Screens are 1440 px wide on desktop and 390 px on mobile, and each is named `<code> / <title>`.
Review notes sit as loose text above each screen, outside the product UI.
Three early Paper Pop concepts (`3:53`, `3:54`, `3:55`) sit above the flows for comparison; where they disagree with the flows, the flows win.

## What the screens are, and are not

- Each screen illustrates one state; scores and boards are examples, not one continuous match.
- The game rules in [games/](games/) are the contract.
  A screen that contradicts them is a design bug, not a rule change; for example, Minesweeper rooms have simultaneous irreversible picks, no flags and no separate lock button; flags exist only on your own.
- The shared canvas keeps the 798 × 598 bitmap's ratio; the Large Minesweeper board on mobile pans horizontally.
- Some screens are UX the old app never had: the final results panel, the leave confirmation, the invite sheet, mobile tabs and the rules dialog; Ryan approved them with the rest of the file.
- Mobile covers the main flows, not a mobile version of every desktop state.
  Make 24 and Pairs keep their phone screens in their own sections, and Minesweeper solo's (MS05) in 03.
- Solo screens show a visitor with no name where it matters (MS01-MS05: no avatar); a visitor who has a name sees it as usual (T01-T05, PR01-PR04).
- Prototype links are partial; this is a design, not a clickable spec of every control.

Decisions from the design review rounds (their reports are in git history):

- A game card says how it can be played and its buttons are the way in: Play solo first where the game has it, because one click starts it with nobody to wait for, then Find a room.
  You pick the game, then how to play it, so a game without a solo mode never shows an empty entry.
- A game screen states the turn in one `Zumpo/Turn bar` above the canvas or board: what is happening, whose turn, and the server's countdown.
- In Draw & Guess the guess is the chat input; it is locked for the drawer and for anyone who has scored this turn, as the server already enforces.
- Brush colours are `color/brush/*` tokens, and the drawer's controls are one `Zumpo/Drawing toolbar`.
- Minesweeper shows each round's outcome as `Zumpo/Pick result` rows: who picked how risky a cell, and what it paid.
- No disabled primary buttons: a request in flight is a status line, and an action you cannot take is not shown.
- Dialogs (leave, invite) sit over the screen they come from, behind a scrim.
- Example data follows one story with four players (Maya, Ryan, Leo, Sam), each with a fixed avatar colour, and every score is computed with the real formula.
- Text on a tinted surface (peach, blue, lime) is ink; muted text is only for cream, paper and sand, where it passes WCAG AA.
- Keyboard focus is a 2 px ink ring 2 px outside the control, distinct from hover's border.
- A line of metadata has at most one middle dot.
- An icon beside text is centred on the text's first line, never top-aligned: a leading icon sits in a slot one line-height tall (`height: 1lh` in code), so a wrapped message keeps it level with line one.
  Trailing indicators, like the check on a selected option, centre on the whole row.

### The room bar

Ryan approved the room bar on 2026-10-04, after a proposal round in Figma.
A seated room has one `Zumpo/Room bar` in place of the header and the room heading: the wordmark, the game, the room and phase tags, How to play, Leave room and the viewer.
On a phone it drops the wordmark, puts the tags under the game and keeps the two actions to their icons.
Every room screen uses it (P07, P11, P12, P15, P16, D01-D15, M01-M16, MO07-MO16), and it is 160 px shorter than the old pair on a desktop and 80 px on a phone.

- A room has no links out but the wordmark: How to play opens over the room (P15), so a game is never lost to a rules check.
- Leave room between games leaves at once; nothing is at stake and the click says what it means.
- Every other way out asks first, mid-game and between games: Leave room mid-game, the wordmark, the browser's back button and Change name.
  Mid-game the dialog names the points that go (P11); between games only the seat (P16).
- While reconnecting the bar has no Leave room; the notice under it says what is happening (P07).
- The room screens' hidden notice layers are gone; the visible notices, such as D10's pending one, stay.

[taste-skill](https://github.com/Leonxlnx/taste-skill)'s `design-taste-frontend` and `redesign-existing-projects` skills are useful review checklists, not authorities: they target landing pages, and where a rule contradicts the brand direction above (its cream-palette and single-accent rules, for example), the brand wins.

## Figma export

The Figma MCP and REST API allowances on the Starter plan are too low to read 167 screens, so a local, read-only plugin in [tools/figma-export/](../tools/figma-export/README.md) snapshots the file instead.
It writes tokens, each Shared pieces family in full detail, one compact JSON per screen, every vector drawing as SVG, an audit of hardcoded values, and PNG previews.
`FORMAT.md` inside each export documents the format.

`npm run design:import` unpacks the newest export into `design/figma/` and regenerates the code tokens from it.
With the bridge running, `npm run design:export` runs the same exporter through it and imports the result in one step.
The JSON and SVG there are committed, so every agent and every worktree can read the design without Figma access, and a diff between two exports shows exactly what a review round changed.
`design/figma/previews/` is ignored: PNGs are regenerated on every export and would bloat history.
Everything in `design/figma/` is generated; change the design in Figma and export again rather than editing it.

## In code

Each Shared pieces family is one component in [`client/src/ui/`](../client/src/ui/index.ts), named as in Figma without the `Zumpo/` prefix; [architecture.md](architecture.md#client) explains how the layer is built.
Variables, text styles and effect styles reach code only through the generated `--zumpo-*` tokens, so a value code needs and Figma lacks is a gap to fix in Figma first, as the menu, dialog and cell shadows were.

To review the design system, run `npm run dev -w client` (it needs no server) and open [`/design`](http://localhost:3001/design).
Every specimen is captioned with its Figma variant, uses that variant's sample copy, and shows its size beside Figma's, in red when they differ by more than half a pixel.
Each family's Figma preview sits under it at the same scale.

`Zumpo/Card` is every focused surface: the one card of a name, create-room, password or error page (Kind=Focused), a dialog over a room (Dialog), and a panel in a page's column, such as an empty or loading lobby (Panel).
Its Title and Description are text properties, and each screen puts its own fields, status and actions into its Content slot, so a change to the surface reaches all 28 screens that use it.
In code the same three are `Card`, `Card kind="panel"` and `Dialog`, which shares the card's styles.

`RoomBar` is `Zumpo/Room bar`, with `layout="phone"` for its Phone variant; `RoomLayout` renders it in the page's header slot, so it stays the page's banner, and `SeatedRoom` guards the navigation its wordmark and the viewer menu start.

Figma gives each sample player an avatar tone by hand; code picks one from a hash of the player's name, so a player keeps one colour in the header, the scoreboard and the results, on every screen.

### Comparing with Figma

`npm run design:compare` builds the app, serves it on port 3320 (`SCREENS_PORT`), and plays [the screens spec](../e2e/screens/screens.spec.ts) with the players and example data of the Figma story, capturing each screen in the state Figma draws, at Figma's width and frame height.
It takes about three minutes, because it runs the real phase lengths so every countdown reads as in Figma.
It writes `design/compare/index.html`, which is ignored by git: every screen's Figma preview beside its capture, flagged when the two sizes differ.
A size that differs because the game holds other content than Figma's example, such as a longer chat, is listed with the reason in [report.ts](../e2e/screens/report.ts) and marked apart; any other difference is layout, to fix or to note below.
So is a screen no state of the app shows.
It needs the previews from the last `npm run design:import`.

### On purpose

Code differs from Figma on purpose in a few places:

- The countdown is up to 7 px wider: DM Sans has no tabular figures, so each digit has a fixed cell and the clock keeps its width as it ticks.
- The chat input's text is 16 px on touch screens, where Figma's 12 px would make iOS zoom the page on focus.
- Hover and focus never change a control's size; Figma's hover variants are wider only because strokes count in its auto layout.
- The chat hugs its messages and scrolls past 358 px of them, so a full chat ends level with the canvas; Figma's empty chats (D01, M01) keep the 354 px of the component's sample messages, which code does not reserve.
- Figma rounds auto-width text boxes up to whole pixels, so a hugging component can be up to a pixel narrower in code.
- The drawer's word-choice clock is Running, as the Countdown's own rule says of a phase you act in; D04 and MO07 keep the Status turn bar's default Waiting tone.
- The header marks the page you are on; Figma draws Games as current on every screen.
- Dialogs are centred in the window, so they sit a few pixels from where each Figma screen places them.
  The invite link's box grows to the whole link: two lines at P12's width, three on a phone, which Figma does not draw.
- A game that ends while the room is open bursts into confetti in the brand accents and the sun brush's gold, at Ryan's request; Figma draws the results still, and a game found finished on arrival or after a refresh is not celebrated.
  It stays off when the system asks for reduced motion, and a Hush game the team lost is not celebrated.
- On a narrow screen the Trios room's turn bar keeps room for two lines of what it says, the longest any phase needs, so the table under it never moves mid-pick; TS12 draws one line.
- The phone name page (MO02) keeps the desktop's Back home button beside Let’s play, as the other phone forms (MO05, MO06) lay out their buttons; MO02 stacks a Cancel under it.
- Daily Word on your own keeps the line under the board as tall as its "Not in the word list" note, so the keyboard never moves when a row is turned back; DW01 and DW02 are 27 px shorter than DW03.
  Where there is no line, on a phone and in a room while guessing, as Figma draws them, the note is said over the board instead, across the row under the one being fixed.
- The others' boards in a Daily Word room stand 12 px apart, not DW07's 16 px: three at 16 px are 2 px wider than the panel holds beside the Desktop keyboard, which Figma lets overflow.

## Editing the Figma file

The file is native Figma throughout: real auto layout, component instances and variables, with no flattened images.
Keep it that way.
A change starts from Shared pieces, variants and tokens, so it reaches every screen, and the Archive and the original concepts stay untouched.

Agents edit it through the [Figma bridge](../tools/figma-bridge/README.md), which runs Plugin API scripts in Figma desktop.
Codex used the Scripter community plugin in Figma's web app instead, driven through a browser, which needs no desktop app or local server.

When editing through the Plugin API:

- There is no `figma.createAutoLayout`; set `layoutMode` and its sibling properties on a frame.
- Do not move children of a nested instance; give the main component responsive auto layout instead.
- `swapComponent` on a variant can keep the old properties; call `setProperties` explicitly afterwards, as with `Zumpo/Mobile tabs` and its `View` property.
- A script that fails halfway can leave orphaned nodes; remove only nodes you can prove the script created.
  Write scripts to be idempotent, so a failed one can simply be run again.
- The file loads pages dynamically: use `getMainComponentAsync`, not `mainComponent`.
- Cloning a variant inside its set drops the clone's `componentPropertyReferences`; rebind them, and only on the clone's own text, never on a nested instance's.
- `findOne` by name also matches layers inside nested instances; filter by `id` (instance sublayers start with `I`) when you mean the component's own layer.
- `resize()` fixes a frame's sizing modes; set them back to `AUTO` afterwards where the frame should hug.
- `layoutSizingHorizontal = 'FILL'` works only after the node is in an auto layout parent.
- Vector paths take no `A` (arc) command; use cubic curves, and reset `x` and `y` to 0 before setting `vectorPaths` again.
- A node moved into an instance's slot keeps its old id, and the API then cannot read anything inside it, so the exporter fails; clone it into the slot and remove the original instead.
  The exporter writes a slot's content under the instance's `slots`.
- Figma desktop suspends the plugin while the screen is locked; a script queued then waits until it is unlocked.
- After any edit, check text and component bounds, roles, real scoring, countdowns, hidden information, canvas ratio, mobile usability and prototype links, then export again.

## Earlier artifacts

The Figma file was built in a Codex session whose handoff, artifact inventory and scripts are in git at commit `dc7c012` (`docs/ZUMPO-CLOUD-HANDOFF.md`, `docs/ZUMPO-ARTIFACT-INVENTORY.json`).
The full local bundle, including the first 83 PNG exports and the build scripts, is on Ryan's machine under `~/.codex/visualizations/2026/10/02/01a0fb53-c0ab-7af1-becf-90bbea4a4123/`.
Those scripts are evidence, not a migration: they hardcode node ids from an earlier state and must not be re-run.
