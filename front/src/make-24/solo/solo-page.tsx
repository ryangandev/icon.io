import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import {
  formatExpression,
  formatFraction,
  isTarget,
} from '../../../../shared/make-24';
import { newSeed, SEED_PATTERN } from '../../../../shared/seed';
import {
  Button,
  ButtonLink,
  Card,
  StatList,
  TurnBar,
  type Stat,
  type TurnBarProps,
} from '../../ui';
import { gameInfo, soloPath } from '../../games/catalog';
import { useSession } from '../../net/session';
import { FormPage } from '../../shell/form-page';
import {
  ChallengeButton,
  ChallengeCard,
  challengeLink,
} from '../../solo/challenge';
import {
  dayLabel,
  formatDuration,
  readBest,
  readDayBests,
  recordBest,
  recordDayBest,
} from '../../solo/device-store';
import { SoloLayout } from '../../solo/solo-layout';
import { SoloResult } from '../../solo/solo-result';
import { useClock } from '../../solo/use-clock';
import {
  cardsAfter,
  FinalCard,
  HandTable,
  StepList,
  TablePanel,
} from '../table';
import {
  isBetweenHands,
  isOver,
  lastResult,
  newRun,
  nextHand,
  RUN_HANDS,
  runTime,
  skip,
  SKIP_PENALTY_MS,
  SKIPPED_PAUSE_MS,
  SOLVED_PAUSE_MS,
  startOver,
  summary,
  takeStep,
  undo,
  type HandResult,
  type SoloRun,
} from './run';
import styles from './solo-page.module.css';

/** Where the best run and the best of each day are kept. */
const BEST_KEY = 'make-24:ten-hands';
/** How many days of bests a finished run lists. */
const DAYS_SHOWN = 3;

const isSeed = (value: string | null): value is string =>
  value !== null && SEED_PATTERN.test(value);

/**
 * T01-T05, T11: Make 24 on your own, a run of ten hands against one clock.
 * `?seed=` is a challenge: the same ten hands somebody else played. It all
 * runs here: nothing reaches the server, and there is no name to ask for.
 */
export function Make24Solo() {
  const [params, setParams] = useSearchParams();
  const linked = params.get('seed');
  // Each run is a fresh mount, so nothing carries over from the last.
  const [playing, setPlaying] = useState<{ seed: string; run: number } | null>(
    null,
  );

  if (playing === null) {
    return (
      <RunPicker
        challenge={isSeed(linked)}
        onStart={() =>
          setPlaying({ seed: isSeed(linked) ? linked : newSeed(), run: 0 })
        }
      />
    );
  }
  return (
    <RunView
      key={playing.run}
      seed={playing.seed}
      onPlayAgain={() => {
        // A challenge is played once; the next run is a new one.
        if (linked !== null) setParams({}, { replace: true });
        setPlaying({ seed: newSeed(), run: playing.run + 1 });
      }}
    />
  );
}

/** T01: what a run is, and the best on this device. */
function RunPicker({
  challenge,
  onStart,
}: {
  challenge: boolean;
  onStart: () => void;
}) {
  const game = gameInfo('make-24');
  const { name } = useSession();
  const best = readBest(BEST_KEY);
  const description = challenge
    ? 'A friend sent you these ten hands. Use each number once to make 24. Stuck? Skip the hand for 30 seconds on the clock.'
    : 'Use each number once to make 24. Stuck? Skip the hand for 30 seconds on the clock.';

  return (
    <FormPage
      heading={{
        eyebrow: 'On your own',
        title: game.name,
        subtitle: game.solo?.summary,
      }}
      phone={{ eyebrow: game.name, subtitle: description }}
      title="Ten hands, one clock."
      description={description}
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onStart();
      }}
      actions={
        <>
          <Button type="submit">Start</Button>
          <ButtonLink
            to={name ? '/games' : '/'}
            variant="secondary"
            icon="back"
          >
            Back to games
          </ButtonLink>
        </>
      }
    >
      <StatList
        className={styles.stats}
        stats={[
          { label: 'Hands', value: String(RUN_HANDS) },
          {
            label: 'Your best on this device',
            value: best === null ? 'Not yet' : formatDuration(best),
            tone: best === null ? 'muted' : undefined,
          },
        ]}
      />
    </FormPage>
  );
}

/** How a finished run compares with the bests before it. */
interface Finish {
  previous: number | null;
  isBest: boolean;
  isDayBest: boolean;
  at: Date;
}

/** T02-T05, T11: the run, from the first hand to its results. */
function RunView({
  seed,
  onPlayAgain,
}: {
  seed: string;
  onPlayAgain: () => void;
}) {
  const [run, setRun] = useState(() => newRun(seed, Date.now()));
  const [finish, setFinish] = useState<Finish | null>(null);
  const now = useClock(run.handStartedAt !== null);
  const between = isBetweenHands(run);

  // A finished hand stays up for a moment; a skipped one a little longer, to
  // read the way it could have gone.
  useEffect(() => {
    if (!between) return;
    const pause = lastResult(run)!.skipped ? SKIPPED_PAUSE_MS : SOLVED_PAUSE_MS;
    const timer = setTimeout(
      () => setRun((current) => nextHand(current, Date.now())),
      pause,
    );
    return () => clearTimeout(timer);
  }, [between, run]);

  const play = (next: SoloRun) => {
    if (next === run) return;
    setRun(next);
    if (isOver(next)) {
      const { timeMs } = summary(next);
      const at = new Date();
      setFinish({
        ...recordBest(BEST_KEY, timeMs),
        ...recordDayBest(BEST_KEY, timeMs, at),
        at,
      });
    }
  };

  const link = challengeLink(soloPath('make-24'), seed);

  if (finish) {
    const { timeMs, solved, skipped, fastestMs } = summary(run);
    const time = formatDuration(timeMs);
    return (
      <SoloLayout
        gameType="make-24"
        phase={{ tone: 'lime', label: 'Run complete' }}
        stage={
          <>
            <SoloResult
              title={`${RUN_HANDS} hands in ${time}.`}
              body={finishBody(finish)}
              stats={[
                { label: 'Solved', value: String(solved) },
                {
                  label: 'Skipped',
                  value: skipped
                    ? `${skipped}, +${formatDuration(skipped * SKIP_PENALTY_MS)}`
                    : '0',
                },
                {
                  label: 'Fastest hand',
                  value:
                    fastestMs === null ? 'None' : formatDuration(fastestMs),
                  tone: fastestMs === null ? 'muted' : undefined,
                },
              ]}
              actions={
                <>
                  <Button onClick={onPlayAgain}>Play again</Button>
                  <ChallengeButton link={link} />
                </>
              }
            />
            <TablePanel>
              <EveryHand results={run.results} />
            </TablePanel>
          </>
        }
        side={
          <>
            <Card kind="panel" title="Best on this device">
              <StatList
                className={styles.stats}
                stats={dayBests(finish, timeMs)}
              />
            </Card>
            <ChallengeCard
              description={`They get these same ten hands and try to beat ${time}.`}
              link={link}
            />
          </>
        }
      />
    );
  }

  const last = between ? lastResult(run)! : null;
  const best = readBest(BEST_KEY);
  return (
    <SoloLayout
      gameType="make-24"
      phase={{ tone: 'blue', label: `Hand ${run.hand + 1} of ${RUN_HANDS}` }}
      stage={
        <>
          <TurnBar {...turnBar(run, now, last)} />
          <TablePanel>
            {last?.skipped ? (
              <FinalCard
                value="24"
                formula={formatExpression(last.expression)}
                state="made"
                prompt="One way to make it. Next hand in a moment."
              />
            ) : (
              <HandTable
                deal={run.deals[run.hand]}
                steps={run.steps}
                onStep={(step) => play(takeStep(run, step, Date.now()))}
                onUndo={() => play(undo(run))}
                onStartOver={() => play(startOver(run))}
                done={last ? 'Next hand in a moment.' : undefined}
                extraTool={
                  <Button
                    variant="quiet"
                    onClick={() => play(skip(run, Date.now()))}
                  >
                    Skip, +30 s
                  </Button>
                }
              />
            )}
            <StepList deal={run.deals[run.hand]} steps={run.steps} />
          </TablePanel>
        </>
      }
      side={
        <>
          <Card kind="panel" title="This run">
            <StatList
              className={styles.stats}
              stats={[
                { label: 'Hand', value: `${run.hand + 1} of ${RUN_HANDS}` },
                { label: 'Solved', value: String(summary(run).solved) },
                { label: 'Skipped', value: String(summary(run).skipped) },
              ]}
            />
          </Card>
          <Card kind="panel" title="Best on this device">
            <StatList
              className={styles.stats}
              stats={[
                {
                  label: 'Ten hands',
                  value: best === null ? 'Not yet' : formatDuration(best),
                  tone: best === null ? 'muted' : undefined,
                },
              ]}
            />
          </Card>
        </>
      }
    />
  );
}

function turnBar(
  run: SoloRun,
  now: number,
  last: HandResult | null,
): TurnBarProps {
  const base = {
    label: `Hand ${run.hand + 1} of ${RUN_HANDS}`,
    kind: 'status' as const,
    countdown: {
      seconds: Math.floor(runTime(run, now) / 1000),
      label: 'run time',
      waiting: true,
    },
  };
  if (last?.skipped) {
    return { ...base, main: 'Skipped', meta: '30 seconds on the clock' };
  }
  if (last) {
    return {
      ...base,
      main: '24! Nice.',
      meta: `Solved in ${formatDuration(last.ms)}`,
    };
  }
  const cards = cardsAfter(run.deals[run.hand], run.steps);
  if (cards.length === 1 && !isTarget(cards[0].value)) {
    return {
      ...base,
      main: `That makes ${formatFraction(cards[0].value)}`,
      meta: 'Undo a step or start over',
    };
  }
  return { ...base, main: 'Make 24', meta: 'Use each number once' };
}

function finishBody({ previous, isBest }: Finish): string {
  if (previous === null) return 'Your first run on this device.';
  return isBest
    ? `A new best on this device. Your last best was ${formatDuration(previous)}.`
    : `Your best on this device is ${formatDuration(previous)}.`;
}

/** The best of the last few days played, today's in green if this run set it. */
function dayBests(finish: Finish, timeMs: number): Stat[] {
  const days = readDayBests(BEST_KEY).slice(0, DAYS_SHOWN);
  // Storage may keep nothing; this run is still today's.
  if (days.length === 0) {
    return [{ label: 'Today', value: formatDuration(timeMs), tone: 'green' }];
  }
  return days.map(({ day, result }, index) => ({
    label: dayLabel(day, finish.at),
    value: formatDuration(result),
    tone: index === 0 && finish.isDayBest ? 'green' : undefined,
  }));
}

/** T05: every hand of the run, how it went and how long it took. */
function EveryHand({ results }: { results: readonly HandResult[] }) {
  return (
    <section className={styles.hands} aria-labelledby="every-hand">
      <h2 id="every-hand" className={styles.heading}>
        Every hand
      </h2>
      <ol className={styles.list}>
        {results.map((result, index) => (
          <li key={index} className={styles.hand}>
            <span className={styles.number}>{index + 1}</span>
            <span className={styles.deal}>{result.deal.join(' ')}</span>
            <span
              className={result.skipped ? styles.skipped : styles.expression}
            >
              {result.skipped
                ? `Skipped · ${formatExpression(result.expression)}`
                : formatExpression(result.expression)}
            </span>
            <span className={styles.time}>{formatDuration(result.ms)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
