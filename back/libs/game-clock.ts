/**
 * How long each phase of a turn lasts. These live on the server because the
 * server is what enforces them — clients are told how much time is left, they
 * do not decide it.
 *
 * Overridable so a game can be sped up for local play or an integration run
 * without touching the code.
 */
const readSecondsFromEnv = (name: string, fallbackSeconds: number): number => {
  const raw = process.env[name];
  if (!raw) return fallbackSeconds;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `Ignoring ${name}="${raw}": expected a positive number of seconds.`,
    );
    return fallbackSeconds;
  }

  return parsed;
};

interface PhaseDurationsInSeconds {
  wordSelecting: number;
  drawing: number;
  reviewing: number;
  /**
   * How long a turn waits for a drawer whose connection dropped mid-drawing.
   * Optional because it is not a phase: the engine falls back to its own
   * default, and a test that only cares about phase lengths need not name it.
   */
  drawerHold?: number;
}

const phaseDurationsInSeconds: PhaseDurationsInSeconds = {
  wordSelecting: readSecondsFromEnv('WORD_SELECT_SECONDS', 15),
  drawing: readSecondsFromEnv('DRAWING_SECONDS', 90),
  reviewing: readSecondsFromEnv('REVIEW_SECONDS', 10),
  drawerHold: readSecondsFromEnv('DRAWER_HOLD_SECONDS', 10),
};

/**
 * Minesweeper's clock. Two durations rather than three phases, because a round
 * is one window in which everybody picks at once.
 */
interface MinesweeperDurationsInSeconds {
  /** How long everybody has to choose a cell. */
  round: number;
  /**
   * How long the outcome stays up before the next round opens. Without it the
   * board would change under the results and nobody would read what their pick
   * had actually risked.
   */
  reveal: number;
}

const minesweeperDurationsInSeconds: MinesweeperDurationsInSeconds = {
  round: readSecondsFromEnv('MINESWEEPER_ROUND_SECONDS', 15),
  reveal: readSecondsFromEnv('MINESWEEPER_REVEAL_SECONDS', 4),
};

/**
 * How long a disconnected player keeps their seat, their score and their place
 * in the round before the room gives up on them.
 *
 * Long enough to cover a refresh, a tab restore or a brief network blip; short
 * enough that a room is not held up by somebody who has actually gone. A player
 * who leaves deliberately is removed at once — this is only for connections
 * that drop.
 */
const reconnectGraceInSeconds = readSecondsFromEnv(
  'RECONNECT_GRACE_SECONDS',
  30,
);

export {
  phaseDurationsInSeconds,
  minesweeperDurationsInSeconds,
  reconnectGraceInSeconds,
};
export type { PhaseDurationsInSeconds, MinesweeperDurationsInSeconds };
