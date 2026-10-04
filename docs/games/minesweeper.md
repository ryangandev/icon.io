# Minesweeper

Everybody plays the same minefield at once. Each round you pick one cell, and
what it pays is **exactly how dangerous it was** — a cell you could prove was
safe is worth almost nothing, and a coin-flip you survive is worth a lot.

Hitting a mine costs you points. It does not end the game, and it does not end
anybody else's.

2–8 players, three board sizes, about 15 seconds a round.

---

## The game loop

A **round** is one window, the same for everyone:

1. **Pick**, 15s — every player chooses one hidden cell. You cannot see what
   anybody else chose, only that they have chosen.
2. **Resolve** — all the picks are scored against the board _as it was when the
   round opened_, and only then are the cells uncovered.
3. **Reveal**, 4s — what everybody picked, what it risked and what it paid.

The pick window ends early the moment everybody has locked in.

Rounds repeat until the board is resolved. That always happens: every round
uncovers at least one cell, so a finite board runs out.

## Winning and losing

**The winner is whoever has the most points when the board runs out.** The game
ends when nothing is left to pick — every safe cell uncovered, every mine found,
or some of each — and the room announces the winner.

**There is no lose condition.** Hitting a mine costs points; it does not remove
you, end the round, or end the game. This is the single biggest departure from
single-player Minesweeper, and it is deliberate: a shared board where one
player's mistake ends everyone's game has a fatal exploit, because whoever is
ahead wants to detonate on purpose and lock their lead in.

You can absolutely finish on a negative score.

## Scoring

Every cell has a **risk**: its probability of being a mine, worked out from
what everybody can see, immediately before the round opens.

```
safe   →  +10 + 90 × risk
mine   →  −20 − 100 × (1 − risk)
```

So surviving a 50/50 pays 55, clearing a provably-safe cell pays 10, and
clearing a cell that was 90% likely to kill you pays 91.

**The penalty is inverted: it grows as the risk falls.** Detonating a cell you
should have read as safe costs 120. Detonating a forced coin-flip costs 70.
Detonating a cell the board had _proved_ was a mine costs only 20. You are
punished for how wrong you were, not for how unlucky — which is what stops the
endgame, where the free cells run out and everybody must guess, from being a
dice roll that decides the match.

Because the expected value falls as risk rises, playing safe is the better move
and gambling is what you do when you are behind. The leader consolidates; the
trailer has to swing.

### Why risk, and not something simpler

Scoring by risk does three things at once:

- **It is verifiable.** Everyone could have computed it, from what everyone
  could see, before anybody clicked. The server works it out from the public
  board — it is not allowed to look at the mine layout, so it cannot score you
  on whether you were lucky.
- **Deduction pays indirectly.** Working out which cells are safe earns you
  nothing on its own; what it earns you is knowing which risks are cheap.
- **It makes turn order irrelevant.** The opening pick is maximum uncertainty
  and is worth the most. Later picks inherit the information earlier ones bought
  and are worth less. Nobody is disadvantaged by when they play.

### Two players, one cell

If several players pick the same cell they **share the reward, and each pays the
full penalty**.

That asymmetry is on purpose. The reward is for _claiming_ a cell — a finite
thing, and three players claiming it have between them uncovered one cell's
worth of board. The penalty is for _the decision_, which is individually yours;
splitting it too would let you hide in a crowd, and make piling onto a coin-flip
cheaper than taking it alone. As it stands, crowding a safe cell is mildly
wasteful and crowding a risky one is punished, so players spread out.

### Running out of time

If the clock beats you, the server picks **the safest cell on the board** for
you and you forfeit the +10 base — so an auto-play is never better than turning
up, but a dropped connection does not wreck your game. A player who is
disconnected sits the round out entirely.

## How to play

1. Enter a username on the landing page and pick Minesweeper from the Gamehub.
2. **Create a room** — name, 2–8 seats, a board size, and an optional password —
   or **Join** one from the lobby.
3. The room owner (👑) presses **START**. It needs at least two players.
4. Each round, **click one cell**. Your choice highlights blue and locks; the
   player list shows 🔒 beside everybody who has committed.
5. When the round resolves, the summary under the board shows every player's
   pick: what it risked, and what it paid. Green outlines were safe, red hit.
6. Read the numbers the way you always have — a `3` has three mines among its
   eight neighbours — and pick again.

**The risk of a cell is not shown before you pick it.** You are scored by the
solver, not played for by it: working out which cells are safe is the game.
What you see afterwards is what your pick was actually worth.

## Board sizes

| Size       | Board   | Mines | Density | Roughly    |
| ---------- | ------- | ----- | ------- | ---------- |
| **Small**  | 9 × 9   | 10    | 12%     | 2 minutes  |
| **Medium** | 16 × 16 | 40    | 16%     | 8 minutes  |
| **Large**  | 30 × 16 | 99    | 21%     | 20 minutes |

Two single-player conventions are deliberately **not** used:

- **No first-click safety.** That rule exists so an opening click cannot end the
  game — and here a mine ends nothing, so the reason for it is gone. Keeping it
  would also make the first pick's score a lie: the risk is computed from public
  information, which says the opening cell is exactly as dangerous as the
  board's density, and it would not have been.
- **No guaranteed-solvable boards.** Modern generators promise a board can be
  cleared without guessing. Here guessing _is_ the scoring mechanism, so a board
  that forces one is working as intended.

## Rules the server enforces

- **One pick per player per round, and it is final.** You cannot watch who locks
  in and then change your mind — that is what keeps a simultaneous window
  honest.
- **Which cell you picked is never broadcast**, only that you have picked.
  Publishing it would let a late chooser follow the crowd.
- **The mine layout never leaves the server.** A client only ever receives
  hidden / a number / a mine somebody hit.
- **Every pick in a round is scored against the same board** — the one everybody
  could see when they chose. Cells are uncovered only after scoring, so a cell
  another player's cascade would have opened still pays what it was worth.
- **Only the room owner may start a game**, and only with two or more players.
- **A cell that is already resolved cannot be picked**, and neither can a cell
  outside the board.

## Leaving, dropping and coming back

A dropped connection keeps your seat, score and the crown for 30 seconds, as in
every room here. There is no turn to hold — a round belongs to everybody — so
the only effect is that the room stops waiting for you: rounds resolve without
your pick, and you score nothing until you are back.

If the room falls below two players the game ends.

## Configuration

| Variable                     | Default | Purpose                                    |
| ---------------------------- | ------- | ------------------------------------------ |
| `MINESWEEPER_ROUND_SECONDS`  | `15`    | How long everybody has to pick             |
| `MINESWEEPER_REVEAL_SECONDS` | `4`     | How long the outcome stays up              |
| `RECONNECT_GRACE_SECONDS`    | `30`    | How long a dropped player keeps their seat |

## Where the code lives

Minesweeper is a **game module** on the generic room layer — seats, ownership,
the reconnect grace, chat and the lobby are not its code. See §1 of
[`ANALYSIS.md`](ANALYSIS.md).

| File                                                          | Responsibility                                 |
| ------------------------------------------------------------- | ---------------------------------------------- |
| [`module.ts`](../back/socket/minesweeper/module.ts)           | What the room layer calls, and all it calls    |
| [`game-engine.ts`](../back/socket/minesweeper/game-engine.ts) | The round loop, and what a round resolves to   |
| [`probability.ts`](../back/socket/minesweeper/probability.ts) | The exact solver — every score comes from it   |
| [`scoring.ts`](../back/socket/minesweeper/scoring.ts)         | The payout curves, and why they are that shape |
| [`board.ts`](../back/socket/minesweeper/board.ts)             | The minefield, and the public view of it       |
| [`state.ts`](../back/socket/minesweeper/state.ts)             | The game's state, and the two wire snapshots   |

Its events are all prefixed `ms:`.

### The solver

[`probability.ts`](../back/socket/minesweeper/probability.ts) computes the true
posterior, not an estimate. Every revealed number constrains its hidden
neighbours; the **frontier** — cells touching a number — splits into independent
components, each component's satisfying assignments are enumerated by
backtracking, and the **sea** — cells touching nothing — is folded in by
weighting each frontier mine-count by `C(|sea|, remaining − t)`.

The counts are `bigint` because they genuinely overflow: `C(300, 99)` has 82
digits, and on a Large board a double would turn every score into `NaN`.

It matters that this is exact rather than a per-constraint heuristic. The
classic **1-2-1** pattern — three numbers reading 1, 2, 1 over three hidden cells
— has exactly one solution, mine-safe-mine, and a local estimate puts the middle
cell at 2/3 where the truth is 0. Getting that wrong would not crash anything;
it would just quietly pay people the wrong amount forever. It is pinned down by
[`minesweeper-probability.test.ts`](../back/tests/minesweeper-probability.test.ts),
including the invariant that the risks of all hidden cells must sum to the number
of mines still out there — which they do, on hand-built boards and on real ones
part-way through a game.
