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
}

const phaseDurationsInSeconds: PhaseDurationsInSeconds = {
  wordSelecting: readSecondsFromEnv('WORD_SELECT_SECONDS', 15),
  drawing: readSecondsFromEnv('DRAWING_SECONDS', 90),
  reviewing: readSecondsFromEnv('REVIEW_SECONDS', 10),
};

export { phaseDurationsInSeconds };
export type { PhaseDurationsInSeconds };
