# Draw & Guess

One player draws a word; everyone else races to type it. The faster you guess,
the more it is worth — and the drawer takes a cut of whatever you earn, so a
drawing people get quickly is a good drawing.

2–8 players, 1–4 rounds, about 90 seconds a turn.

---

## The game loop

A **game** is a number of **rounds**, chosen when the room is created. In each
round every player draws exactly once, in a random order, so a 2-round game with
4 players is 8 turns.

One word category — Fruits, Animals, League Of Legends, Electronics, Sports or
Food — is drawn at random for the whole game and shown to everyone.

Each **turn** has three phases, and the server decides when each one ends:

| Phase           | Length | What happens                                                                  |
| --------------- | ------ | ----------------------------------------------------------------------------- |
| **Word select** | 15s    | The drawer picks one of three words from the category. Nobody else sees them. |
| **Drawing**     | 90s    | The drawer draws; everyone else guesses in the chat box.                      |
| **Review**      | 10s    | The word is revealed to the room.                                             |

The drawing phase ends early the moment everybody has guessed — there is nothing
left to draw for, and the rest of the clock would be dead time.

When the last turn of the last round finishes, the game ends and the room reopens
for a new one. Scores are shown throughout, in the player list, ranked.

## Winning and losing

**There is no lose condition.** Draw & Guess is a race for points, not an
elimination game: a turn you guess nothing on costs you nothing but the points
you did not take.

**The winner is whoever has the most points when the last round ends.** Nothing
in the UI crowns them — the player list is sorted by score, so the winner is
whoever is sitting at #1 when the game ends. (A round summary screen is on the
roadmap; see [`ANALYSIS.md`](ANALYSIS.md).)

## Scoring

A correct guess is worth **50 points for getting there at all, plus up to 100
more for how much of the drawing phase is left**:

```
guesser = 50 + round(100 × fraction of the drawing phase remaining)
drawer  = round(guesser × 0.4)
```

So a guess in the first second is worth about 150 and one in the last second
about 50, and the drawer takes two fifths of whatever the guesser earned. Every
guesser is scored independently, so the drawer's total for a turn grows with how
many people got it.

You can only score **once per turn**. The drawer cannot guess their own word.

## How to play

1. Enter a username on the landing page and pick Draw & Guess from the Gamehub.
2. **Create a room** — name, 2–8 seats, 1–4 rounds, and an optional password —
   or **Join** one from the lobby table. Locked rooms prompt for the password.
3. The room owner (👑) presses **START**. It needs at least two players.
4. **When it is your turn** (🖌️), pick one of three words within 15 seconds, then
   draw it. You have a colour picker, four brush sizes, undo and clear.
5. **When it is not**, type guesses into the chat box. Matching is
   case-insensitive and ignores surrounding spaces, so `steak`, `Steak` and
   `STEAK` all count.
6. A wrong guess is just chat — everyone sees it, which is half the fun.

## Rules the server enforces

None of these are UI-only. The client shows them, and the server checks them, so
a modified client gains nothing:

- **Only the drawer may draw**, and only during a drawing phase. That covers
  drawing, undo and clear — a stranger with a room id off the lobby broadcast
  used to be able to wipe a room's canvas with one event.
- **Only the room owner may start a game**, and only with two or more players.
- **Only a seat-holder may read a room's state**, so a locked room's player list
  is not readable by anyone who has a room id.
- **The drawer cannot guess**, nor can anyone who has already scored this turn,
  nor can anyone during the review phase when the word is on screen.
- **Only a seat-holder may talk** in a room.
- **Nothing a client sends advances a phase.** The clock lives on the server; a
  client is told how many milliseconds are left and renders a countdown from it.

## Hints

The row of underscores gets easier as the drawing clock runs down: two reveals,
evenly spaced through the phase, uncovering up to a third of the letters between
them. Spaces are kept as they are, so "Ice Cream" hints as `___ _____` and a
two-word answer looks like one. Short words give up less — "Pear" reveals one
letter, never two.

## Leaving, dropping and coming back

**A dropped connection is not a departure.** If your connection drops you keep
your seat, your score, the crown and your place in the round for 30 seconds.
Others see you marked away (📴) rather than gone. Reload the page and you are the
same player, in the same seat.

**A drawer who drops keeps their turn too**, but only for 10 seconds and only
once the drawing has started — long enough for a refresh, short enough that a
room whose drawer has actually gone is not left watching a frozen canvas. They
come back to the same board, the same word and the same clock.

**Leaving deliberately takes effect at once.** If the drawer leaves, the turn is
skipped; if the owner leaves, the crown passes to another player; if the room
drops below two players mid-game, the game ends rather than stalling.

A room with nobody left in it is deleted.

## What the server owns

Everything that decides an outcome:

- **The clock** — one timer per room, in
  [`game-engine.ts`](../back/socket/draw-and-guess/game-engine.ts).
- **The word** — sent to the drawer alone, and omitted rather than blanked from
  the room snapshot so that a broadcast cannot clobber the drawer's own copy.
- **The drawing** — the same replayable stroke list every client builds, kept
  server-side so that a player arriving mid-turn is sent the board rather than a
  blank one.
- **The scores** — awarded where the clock is known, because what a guess is
  worth depends on how much of the phase is left.

## Configuration

Phase lengths are server-side settings, because the server is what enforces them.
Shorten them to play a whole game through in seconds while developing:

| Variable                  | Default | Purpose                                        |
| ------------------------- | ------- | ---------------------------------------------- |
| `WORD_SELECT_SECONDS`     | `15`    | How long the drawer has to pick a word         |
| `DRAWING_SECONDS`         | `90`    | Length of the drawing phase                    |
| `REVIEW_SECONDS`          | `10`    | How long the word is shown after a turn        |
| `DRAWER_HOLD_SECONDS`     | `10`    | How long a turn waits for a drawer who dropped |
| `RECONNECT_GRACE_SECONDS` | `30`    | How long a dropped player keeps their seat     |

## Where the code lives

Draw & Guess is a **game module** on the generic room layer — seats, ownership,
the reconnect grace and the lobby are not its code. See §1 of
[`ANALYSIS.md`](ANALYSIS.md) for the split.

| File                                                                                                       | Responsibility                                  |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [`module.ts`](../back/socket/draw-and-guess/module.ts)                                                     | What the room layer calls, and all it calls     |
| [`game-engine.ts`](../back/socket/draw-and-guess/game-engine.ts)                                           | The turn state machine and the phase clock      |
| [`state.ts`](../back/socket/draw-and-guess/state.ts)                                                       | The game's state, and the two wire snapshots    |
| [`chat-events-handler.ts`](../back/socket/draw-and-guess/chat-events-handler.ts)                           | The guess channel — scored, not chat            |
| [`whiteboard-canvas-events-handler.ts`](../back/socket/draw-and-guess/whiteboard-canvas-events-handler.ts) | Relay draw / undo / clear                       |
| [`canvas.ts`](../back/socket/draw-and-guess/canvas.ts)                                                     | The room's drawing, as a replayable stroke list |
| [`words.ts`](../back/socket/draw-and-guess/words.ts)                                                       | Picking words and hiding them                   |
| [`validation.ts`](../back/socket/draw-and-guess/validation.ts)                                             | This game's inbound shapes                      |

Its events are all prefixed `dg:`. Everything generic — `room:`, `lobby:`,
`chat:`, `game:start` — belongs to the room layer and is listed in
[`shared/wire-types.d.ts`](../shared/wire-types.d.ts).
