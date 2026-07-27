/**
 * What a pick is worth.
 *
 * A cell's score is the risk it carried — its mine probability computed from
 * public information immediately before the round. That definition does three
 * useful things at once, and the whole game rests on them:
 *
 * 1. **It is verifiable.** Everyone could have computed it, from what everyone
 *    could see, before anybody clicked.
 * 2. **Deduction does not pay directly; it pays by telling you which risks are
 *    cheap.** A cell you can prove is safe is worth almost nothing, and knowing
 *    which cells those are is the entire skill.
 * 3. **It fixes turn order for free.** The first pick of a game is maximum
 *    uncertainty, so it is worth the most. Later picks inherit the information
 *    earlier ones bought and are worth less. Nobody is disadvantaged by when
 *    they play, which is otherwise the hardest thing about a shared board.
 */

/** Even a provably-safe cell is worth taking, so free cells still get cleared. */
const SAFE_BASE = 10;
/** …and a coin-flip is worth ten times that. */
const SAFE_RISK_WEIGHT = 90;

/**
 * The penalty is **inverted**: it grows as the risk *falls*.
 *
 * You are punished for how wrong you were, not for how unlucky. Detonating a
 * cell you should have read as safe is a blunder and costs 120; detonating a
 * forced coin-flip costs 70, because there was nothing better to do. Without
 * this the endgame — where the free cells run out and everybody must guess —
 * would be a dice roll deciding the match.
 */
const MINE_BASE = 20;
const MINE_CARELESSNESS_WEIGHT = 100;

interface PickPayout {
  /** The cell's mine probability before the round, from public info alone. */
  risk: number;
  hitMine: boolean;
  /** How many players picked this same cell, including this one. */
  sharedWith: number;
  /** The clock ran out and the server picked the safest cell for them. */
  autoPlayed: boolean;
}

/**
 * Collisions split the reward but not the penalty, which is deliberately
 * asymmetric.
 *
 * The reward is for *claiming* a cell — a finite thing, and if three players
 * claim it they have between them uncovered one cell's worth of board. The
 * penalty is for *the decision*, which is individually yours: splitting it too
 * would let you hide in a crowd, and piling onto a coin-flip to pay a third of
 * the price is exactly backwards.
 *
 * What falls out is that crowding a safe cell is mildly wasteful and crowding a
 * risky one is punished, so players spread across the board — which is also what
 * makes a round interesting to watch.
 */
const pointsForPick = ({
  risk,
  hitMine,
  sharedWith,
  autoPlayed,
}: PickPayout): number => {
  if (hitMine) {
    return -Math.round(MINE_BASE + MINE_CARELESSNESS_WEIGHT * (1 - risk));
  }

  // Letting the clock run out plays the safest cell available, and forfeits the
  // base — enough that being present is worth something, not so much that a
  // dropped connection wrecks a game.
  const base = autoPlayed ? 0 : SAFE_BASE;
  const reward = base + SAFE_RISK_WEIGHT * risk;

  return Math.round(reward / Math.max(1, sharedWith));
};

export {
  pointsForPick,
  SAFE_BASE,
  SAFE_RISK_WEIGHT,
  MINE_BASE,
  MINE_CARELESSNESS_WEIGHT,
};
export type { PickPayout };
