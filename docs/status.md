# Status

Where the project stands, what is waiting on whom, and what comes next.
Resolved items are deleted, not archived; history is in git.

## Now

Icon.io is being rebranded and redesigned as **Zumpo** on the `rework` branch.
The redesign is an editable Figma file of 82 screens and its shared component families (see [design.md](design.md)), with a snapshot in `design/figma/`.
Ryan approved it in review round two on 2026-10-03, after one fix (icons centred on their line of text); Claude's round 1 changes are in the [round 1 report](../design/reviews/2026-10-03-round-1.md).

Implementation is approved.
The design system is built in code: every Shared pieces family is a component in `front/src/ui/`, with tokens generated from the export, and matches Figma in the `/design` gallery to within anti-aliasing (see [design.md](design.md#in-code)).
The pages still run on Ant Design.
The backend speaks the snapshot-driven wire contract in `shared/wire-types.d.ts` ([architecture](architecture.md#the-wire-contract)); the current pages still speak the old one, so they work again only once they are rebuilt on it.

## Product direction

Decided by Ryan, and the frame for every design and implementation choice:

- Keep three ways to play long term: on your own, with friends, and light competition.
- Grow into a platform of web mini-games that are easy to start, short, and easy to share.
- "Short" is the product direction; it does not approve changing the current games' timings.
- "On your own" is a future direction; it does not yet commit to offline play, a PWA, or every game supporting every mode.
- Earlier reports are a source of facts about features, not of product, brand or visual direction.

## Waiting on Ryan

- The open questions in the [round 1 report](../design/reviews/2026-10-03-round-1.md#需要你决定) and its copy suggestions, before the pages that show them are rebuilt.
  Until then the screens are built as drawn.
- Whether `Zumpo/Modal` should become the one focused card.
  It uses the Title style and no screen uses it; the 20+ focused cards (P02-P10, DL04-DL11, ML04-ML10) and the two dialogs are hand-built frames with a Heading title, which code follows.
  Making Modal match them and swapping the frames for instances would make one change reach every card.

## Next

1. Rebuild the pages on the design system, platform flow first, then each game, then mobile, and remove Ant Design ([why](architecture.md#frontend)).
   Fix the known issues below that live in the pages being rebuilt, reproducing each end to end first.
2. Make the pixel comparison against Figma repeatable for pages, not only component sizes: render each screen and variant at 2x and diff it against the page, as was done by hand for the components.

## Open decisions

| Decision             | Where it stands                                                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deployment           | Deferred by Ryan. Constraints: free to start, pay only once there is real demand, not all-Vercel. One Node service works as is; a split static frontend was discussed, not chosen. Re-check providers' current terms when this resumes; earlier findings are stale. |
| Solo play            | Direction only. Demo, practice mode or bots not chosen. Today both games need two players, so a lone visitor waits forever.                                                                                                                                         |
| Code and repo naming | When the code, package names and repository move from Icon.io to Zumpo.                                                                                                                                                                                             |
| Domain and trademark | Availability for Zumpo not checked. A Chinese name is deliberately undecided.                                                                                                                                                                                       |

## Known issues

| Issue                                             | Notes                                                                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Narrow screens                                    | Side panels and chat overflow horizontally; the canvas handles mouse events only, so touch drawing does not work.                    |
| Bundle size                                       | Main JS about 1 MB (330 kB gzip), two drawing background images about 1 MB and 1.4 MB, and a chunk-size warning on build.            |
| Backend dependency advisories                     | A 2026-10-02 audit of backend production dependencies reported engine.io (high) and qs (moderate). Re-run `npm audit` before acting. |
| Old public URL                                    | `icon.ryiscrispy.com` no longer resolves; nothing is deployed.                                                                       |
| A drawer who vanishes freezes the canvas for 10 s | The deliberate bound of the drawer hold ([architecture](architecture.md#identity-and-reconnection)).                                 |

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
