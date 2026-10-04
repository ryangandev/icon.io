# Status

Where the project stands, what is waiting on whom, and what comes next.
Resolved items are deleted, not archived; history is in git.

## Now

Icon.io is being rebranded and redesigned as **Zumpo** on the `rework` branch.
No application code has changed yet.
The redesign exists as an editable Figma file of 82 screens and its shared component families (see [design.md](design.md)).
Claude's first review pass is done and edited into Figma through the [bridge](../tools/figma-bridge/README.md); what changed and what is left to decide is in the [round 1 report](../design/reviews/2026-10-03-round-1.md).
A snapshot of it is in `design/figma/`.

The order of work, agreed with Ryan: Figma first, reviewed screen by screen, then implementation.
Implementation has not been approved yet.

## Product direction

Decided by Ryan, and the frame for every design and implementation choice:

- Keep three ways to play long term: on your own, with friends, and light competition.
- Grow into a platform of web mini-games that are easy to start, short, and easy to share.
- "Short" is the product direction; it does not approve changing the current games' timings.
- "On your own" is a future direction; it does not yet commit to offline play, a PWA, or every game supporting every mode.
- Earlier reports are a source of facts about features, not of product, brand or visual direction.

## Waiting on Ryan

- Review round two in Figma, starting from the [round 1 report](../design/reviews/2026-10-03-round-1.md), and answer its open questions.

## Next

1. Ryan reviews round two; Claude applies the outcome through the bridge and exports again.
2. Build the design system: tokens generated from the export, then the Shared pieces as code components on headless primitives with Zumpo's own styles, checked against the Figma previews.
   Ant Design goes away ([why](architecture.md#frontend)).
3. Rebuild the pages on it, platform flow first, then each game, then mobile.
   Fix the known issues below that live in the pages being rebuilt, reproducing each end to end first.

## Open decisions

| Decision             | Where it stands                                                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deployment           | Deferred by Ryan. Constraints: free to start, pay only once there is real demand, not all-Vercel. One Node service works as is; a split static frontend was discussed, not chosen. Re-check providers' current terms when this resumes; earlier findings are stale. |
| Solo play            | Direction only. Demo, practice mode or bots not chosen. Today both games need two players, so a lone visitor waits forever.                                                                                                                                         |
| Code and repo naming | When the code, package names and repository move from Icon.io to Zumpo.                                                                                                                                                                                             |
| Domain and trademark | Availability for Zumpo not checked. A Chinese name is deliberately undecided.                                                                                                                                                                                       |

## Known issues

| Issue                                             | Notes                                                                                                                                                                                                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Minesweeper refresh during pick or reveal         | Observed in a two-player browser session: after a refresh the UI asks for a pick already made, or loses the reveal. The snapshot has no explicit reveal phase and the player's own pick is kept only client-side. Fix without ever sending one player's pick to another. |
| Narrow screens                                    | Side panels and chat overflow horizontally; the canvas handles mouse events only, so touch drawing does not work.                                                                                                                                                        |
| Bundle size                                       | Main JS about 1 MB (330 kB gzip), two drawing background images about 1 MB and 1.4 MB, and a chunk-size warning on build.                                                                                                                                                |
| Backend dependency advisories                     | A 2026-10-02 audit of backend production dependencies reported engine.io (high) and qs (moderate). Re-run `npm audit` before acting.                                                                                                                                     |
| Old public URL                                    | `icon.ryiscrispy.com` no longer resolves; nothing is deployed.                                                                                                                                                                                                           |
| A drawer who vanishes freezes the canvas for 10 s | The deliberate bound of the drawer hold ([architecture](architecture.md#identity-and-reconnection)).                                                                                                                                                                     |

## Backlog

Ideas worth doing once the rework lands, roughly in order:

- Spectators, or letting a latecomer in for the next round; the canvas is already server state.
- A round summary and close-guess feedback ("Sam is close!"); the server knows what it awarded and does not say.
- A longer word bank and per-room word packs; six fixed categories today.
- One command that starts both dev servers.

## Deliberately not doing

- Migrating to Next.js: the redesign is a UI change, and the server model does not need it.
- Accounts: a name and a per-tab identity are the product.
- Horizontal scaling: rooms and clocks live in one process (see [architecture](architecture.md#code-map)).
- Changing game rules or timings as part of the redesign; rule changes are their own decisions.
