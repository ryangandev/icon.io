# Status

Where the project stands, what is waiting on whom, and what comes next.
Resolved items are deleted, not archived; history is in git.

## Now

Icon.io is being rebranded and redesigned as **Zumpo** on the `rework` branch.
The redesign is an editable Figma file of 82 screens and its shared component families (see [design.md](design.md)), with a snapshot in `design/figma/`.
Ryan approved it in review round two on 2026-10-03, after one fix (icons centred on their line of text); Claude's round 1 changes are in the [round 1 report](../design/reviews/2026-10-03-round-1.md).

The implementation is built on `rework`, which is not pushed or merged yet.
Every page, desktop and phone, is rebuilt on the Zumpo design system in `front/src/ui/`, and Ant Design is gone ([architecture](architecture.md#frontend)).
Both sides speak the snapshot-driven wire contract in `shared/wire-types.d.ts` ([architecture](architecture.md#the-wire-contract)).
The screens were compared with Figma one by one in a browser with two players; where code differs on purpose, [design.md](design.md#in-code) says so.

## Product direction

Decided by Ryan, and the frame for every design and implementation choice:

- Keep three ways to play long term: on your own, with friends, and light competition.
- Grow into a platform of web mini-games that are easy to start, short, and easy to share.
- "Short" is the product direction; it does not approve changing the current games' timings.
- "On your own" is a future direction; it does not yet commit to offline play, a PWA, or every game supporting every mode.
- Earlier reports are a source of facts about features, not of product, brand or visual direction.

## Waiting on Ryan

- Review `rework` in the browser, then whether to push it and open a pull request.
- Whether a Minesweeper refresh should hold the round.
  A refresh drops the connection for a moment, and the room does not wait for a disconnected player, so if everyone else has already locked in, the round resolves without the refreshing player's pick.
  That contradicts the rule "A refresh loses nothing" in [minesweeper.md](games/minesweeper.md); the rules are kept as they are until you decide.
- Whether `Zumpo/Modal` should become the one focused card.
  It uses the Title style and no screen uses it; the 20+ focused cards (P02-P10, DL04-DL11, ML04-ML10) and the two dialogs are hand-built frames with a Heading title, which code follows.
  Making Modal match them and swapping the frames for instances would make one change reach every card.

## Next

1. Commit the two-player browser checks that verified the rebuild, so a change to a flow can be checked again with one command rather than by hand.
2. Make the pixel comparison against Figma repeatable for pages, not only component sizes: drive the app into each screen's state and diff it against the screen's preview, as was done by hand for the rebuild.

## Open decisions

| Decision             | Where it stands                                                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deployment           | Deferred by Ryan. Constraints: free to start, pay only once there is real demand, not all-Vercel. One Node service works as is; a split static frontend was discussed, not chosen. Re-check providers' current terms when this resumes; earlier findings are stale. |
| Solo play            | Direction only. Demo, practice mode or bots not chosen. Today both games need two players, so a lone visitor waits forever.                                                                                                                                         |
| Code and repo naming | When the code, package names and repository move from Icon.io to Zumpo.                                                                                                                                                                                             |
| Domain and trademark | Availability for Zumpo not checked. A Chinese name is deliberately undecided.                                                                                                                                                                                       |

## Known issues

| Issue                                             | Notes                                                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Old public URL                                    | `icon.ryiscrispy.com` no longer resolves; nothing is deployed.                                       |
| A drawer who vanishes freezes the canvas for 10 s | The deliberate bound of the drawer hold ([architecture](architecture.md#identity-and-reconnection)). |

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
