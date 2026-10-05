# Status

Where the project stands, what is waiting on whom, and what comes next.
Resolved items are deleted, not archived; history is in git.

## Now

The project is rebranded and redesigned as **Zumpo**; the code, packages, folder and repository carry the name.
The redesign is an editable Figma file of 111 screens and its shared component families (see [design.md](design.md)), with a snapshot in `design/figma/`.
Ryan approved it in review round two on 2026-10-03, after one fix (icons centred on their line of text).

The implementation was built on `rework` and merged into `main` on 2026-10-05 ([#26](https://github.com/ryangandev/zumpo/pull/26)).
Every page, desktop and phone, is rebuilt on the Zumpo design system in `front/src/ui/`, and Ant Design is gone ([architecture](architecture.md#frontend)).
Both sides speak the snapshot-driven wire contract in `shared/wire-types.d.ts` ([architecture](architecture.md#the-wire-contract)).
`npm run e2e` plays the main flows with two players, and `npm run design:compare` captures every Figma screen's state beside its preview; where code differs on purpose, [design.md](design.md#on-purpose) says so.

## Product direction

Decided by Ryan, and the frame for every design and implementation choice:

- Keep three ways to play long term: on your own, with friends, and light competition.
- Grow into a platform of web mini-games that are easy to start, short, and easy to share.
- "Short" is the product direction; it does not approve changing the current games' timings.
- "On your own" starts with solo modes for Make 24, Pairs and Minesweeper; it does not commit to offline play, a PWA, or every game supporting every mode.
- Earlier reports are a source of facts about features, not of product, brand or visual direction.

## Waiting on Ryan

- Whether a Minesweeper refresh should hold the round.
  A refresh drops the connection for a moment, and the room does not wait for a disconnected player, so if everyone else has already locked in, the round resolves without the refreshing player's pick.
  That contradicts the rule "A refresh loses nothing" in [minesweeper.md](games/minesweeper.md); the rules are kept as they are until you decide.

## Next

Two new games and solo play, decided by Ryan on 2026-10-04, are built and merged.
Minesweeper, Make 24 and Pairs each play on your own with no name asked (`/games/<game>/solo`), Make 24 and Pairs play in rooms too, and every game card and How to play offer Play solo where the game has it.
`npm run e2e` plays each new flow, and `npm run design:compare` captures every one of their Figma screens with no layout difference.
What is left needs the Figma file, which Claude could not reach this time:

1. Run `npm run design:export`, so the export carries the Ring and Half symbols' arcs, then delete `ARCS_BEFORE_EXPORT` in `tools/design-tokens/generate.mjs`, which stands in with arcs measured from the previews.
2. In T09, space the table panel's children 20 apart, as T08 and the code do; T09 uses 24.
3. Redraw P13 and P14 with all four games, as P04 already has them, and give P14's solo games the same Play solo and Find a room pair as P04's cards.
4. In the 00 / Review guide, drop the sentence pointing at `design/reviews/`; the review reports were folded into [design.md](design.md) and deleted.

## Open decisions

| Decision             | Where it stands                                                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deployment           | Deferred by Ryan. Constraints: free to start, pay only once there is real demand, not all-Vercel. One Node service works as is; a split static frontend was discussed, not chosen. Re-check providers' current terms when this resumes; earlier findings are stale. |
| Domain and trademark | Availability for Zumpo not checked. A Chinese name is deliberately undecided.                                                                                                                                                                                       |

## Known issues

| Issue                                             | Notes                                                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Old public URL                                    | `icon.ryiscrispy.com` no longer resolves; nothing is deployed.                                       |
| A drawer who vanishes freezes the canvas for 10 s | The deliberate bound of the drawer hold ([architecture](architecture.md#identity-and-reconnection)). |

## Backlog

Ideas worth doing next, roughly in order:

- Spectators, or letting a latecomer in for the next round; the canvas is already server state.
- A round summary and close-guess feedback ("Sam is close!"); the server knows what it awarded and does not say.
- A longer word bank and per-room word packs; six fixed categories today.
- One command that starts both dev servers.

## Deliberately not doing

- Migrating to Next.js: the redesign is a UI change, and the server model does not need it.
- Accounts: a name and a per-tab identity are the product.
- Horizontal scaling: rooms and clocks live in one process (see [architecture](architecture.md#code-map)).
- Changing game rules or timings as part of the redesign; rule changes are their own decisions.
