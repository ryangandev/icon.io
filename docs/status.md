# Status

Where the project stands, what is waiting on whom, and what comes next.
Resolved items are deleted, not archived; history is in git.

## Now

The project is rebranded and redesigned as **Zumpo**; the code, packages, folder and repository carry the name.
The redesign is an editable Figma file of 167 screens and its shared component families (see [design.md](design.md)), with a snapshot in `design/figma/`.
Ryan approved it in review round two on 2026-10-03, after one fix (icons centred on their line of text).

The implementation was built on `rework` and merged into `main` on 2026-10-05 ([#26](https://github.com/ryangandev/zumpo/pull/26)).
Every page, desktop and phone, is rebuilt on the Zumpo design system in `client/src/ui/`, and Ant Design is gone ([architecture](architecture.md#client)).
Both sides speak the snapshot-driven wire contract in `shared/wire-types.d.ts` ([architecture](architecture.md#the-wire-contract)).
`npm run e2e` plays the main flows with two players, and `npm run design:compare` captures every Figma screen's state beside its preview; where code differs on purpose, [design.md](design.md#on-purpose) says so.

On 2026-10-05 Ryan chose to host it for a few testers on Render's free plan, and it is live at `zumpo.ryangan.me` ([architecture](architecture.md#deployment)).
The server was hardened for that the same day ([#30](https://github.com/ryangandev/zumpo/pull/30)): a restart tells each room it closed, a duplicated tab takes over its player, what a client can make the server hold is bounded, and Render checks `/healthz`.

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

Four more games, chosen by Ryan on 2026-10-05, are designed in Figma: Trios (section 07), Liar's Dice (08), Hush (09) and Daily Word (10).
Daily Word, Hush and Liar's Dice are merged; Trios follows on its own branch.
Trios, Liar's Dice and Daily Word play on your own and in rooms; Hush is rooms only, because it needs at least two players.
Their behaviour contracts land in `docs/games/` with each game.
The hub, home and How to play screens (P01, P04, P13, P14, MO01, MO03) already show all eight games, so until every game is merged, `npm run design:compare` finds those screens with more cards than the code.

## Open decisions

| Decision             | Where it stands                                                                                                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosting past testing | Render's free plan is for testing ([architecture](architecture.md#deployment)). Ryan's constraints: free to start, pay only once there is real demand, not all-Vercel. Once people play regularly, an always-on instance (Render's paid plans, or Fly.io from about $3 a month) removes the cold start. |
| Domain and trademark | Testing runs on Ryan's `zumpo.ryangan.me`; a domain of Zumpo's own is not checked. A Chinese name is deliberately undecided.                                                                                                                                                                            |

## Known issues

| Issue                                             | Notes                                                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| A drawer who vanishes freezes the canvas for 10 s | The deliberate bound of the drawer hold ([architecture](architecture.md#identity-and-reconnection)). |

## Backlog

Ideas worth doing next, roughly in order:

- Spectators, or letting a latecomer in for the next round; the canvas is already server state.
- A round summary and close-guess feedback ("Sam is close!"); the server knows what it awarded and does not say.
- A longer word bank and per-room word packs; six fixed categories today.

## Deliberately not doing

- Migrating to Next.js: the redesign is a UI change, and the server model does not need it.
- Accounts: a name and a per-tab identity are the product.
- Horizontal scaling: rooms and clocks live in one process (see [architecture](architecture.md#code-map)).
- Changing game rules or timings as part of the redesign; rule changes are their own decisions.
