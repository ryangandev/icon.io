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

| Section                              | Id        | Contents                                              |
| ------------------------------------ | --------- | ----------------------------------------------------- |
| 00 / Review guide & flow map         | `9:14700` | Review order, the real rules, which UX is new         |
| 01 / Platform & shared flows         | `9:431`   | P01-P14, desktop                                      |
| 02 / Draw & Guess / complete flow    | `9:866`   | DL01-DL11 lobby, D01-D15 room, desktop                |
| 03 / Minesweeper / complete flow     | `9:2526`  | ML01-ML10 lobby, M01-M16 room, desktop                |
| 04 / Mobile / 390px flow adaptations | `9:10060` | MO01-MO16, the main flows at 390 px                   |
| Shared pieces                        | `9:198`   | Component families, all named `Zumpo/…`               |
| Archive                              | `9:197`   | Club Circuit and Pocket Studio, with their components |

Screens are 1440 px wide on desktop and 390 px on mobile, and each is named `<code> / <title>`.
Review notes sit as loose text above each screen, outside the product UI.
Three early Paper Pop concepts (`3:53`, `3:54`, `3:55`) sit above the flows for comparison; where they disagree with the flows, the flows win.

## What the screens are, and are not

- Each screen illustrates one state; scores and boards are examples, not one continuous match.
- The game rules in [games/](games/) are the contract.
  A screen that contradicts them is a design bug, not a rule change; for example, Minesweeper has simultaneous irreversible picks, no flags and no separate lock button.
- The shared canvas keeps the 798 × 598 bitmap's ratio; the Large Minesweeper board on mobile pans horizontally.
- New UX that does not exist in the app today is marked as proposed and is not yet approved: the final results panel, leave confirmation, invite sheet, mobile tabs, and the rules view.
- Mobile covers the main flows, not a mobile version of every desktop state.
- Prototype links are partial; this is a design, not a clickable spec of every control.

Decisions from the first review round ([report](../design/reviews/2026-10-03-round-1.md)):

- A game screen states the turn in one `Zumpo/Turn bar` above the canvas or board: what is happening, whose turn, and the server's countdown.
- In Draw & Guess the guess is the chat input; it is locked for the drawer and for anyone who has scored this turn, as the server already enforces.
- Brush colours are `color/brush/*` tokens, and the drawer's controls are one `Zumpo/Drawing toolbar`.
- Minesweeper shows each round's outcome as `Zumpo/Pick result` rows: who picked how risky a cell, and what it paid.
- No disabled primary buttons: a request in flight is a status line, and an action you cannot take is not shown.
- Dialogs (leave, invite) sit over the screen they come from, behind a scrim.
- Example data follows one story with four players (Maya, Ryan, Leo, Sam), each with a fixed avatar colour, and every score is computed with the real formula.

## Figma export

The Figma MCP and REST API allowances on the Starter plan are too low to read 82 screens, so a local, read-only plugin in [tools/figma-export/](../tools/figma-export/README.md) snapshots the file instead.
It writes tokens, each Shared pieces family in full detail, one compact JSON per screen, every vector drawing as SVG, an audit of hardcoded values, and PNG previews.
`FORMAT.md` inside each export documents the format.

`npm run design:import` unpacks the newest export into `design/figma/`.
The JSON and SVG there are committed, so every agent and every worktree can read the design without Figma access, and a diff between two exports shows exactly what a review round changed.
`design/figma/previews/` is ignored: PNGs are regenerated on every export and would bloat history.
Everything in `design/figma/` is generated; change the design in Figma and export again rather than editing it.

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
- Figma desktop suspends the plugin while the screen is locked; a script queued then waits until it is unlocked.
- After any edit, check text and component bounds, roles, real scoring, countdowns, hidden information, canvas ratio, mobile usability and prototype links, then export again.

## Earlier artifacts

The Figma file was built in a Codex session whose handoff, artifact inventory and scripts are in git at commit `dc7c012` (`docs/ZUMPO-CLOUD-HANDOFF.md`, `docs/ZUMPO-ARTIFACT-INVENTORY.json`).
The full local bundle, including the first 83 PNG exports and the build scripts, is on Ryan's machine under `~/.codex/visualizations/2026/10/02/01a0fb53-c0ab-7af1-becf-90bbea4a4123/`.
Those scripts are evidence, not a migration: they hardcode node ids from an earlier state and must not be re-run.
