import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { newSeed, SEED_PATTERN } from '../../../../shared/seed';
import {
  Button,
  ButtonLink,
  Card,
  StatList,
  type Stat,
  type TurnBarProps,
} from '../../ui';
import { gameInfo, soloPath } from '../../games/catalog';
import { plural } from '../../games/plural';
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
  MiniTrio,
  TablePanel,
  TableTools,
  TriosTable,
  TriosTurnBar,
  type PlaceView,
} from '../table';
import { whyNotATrio } from '../words';
import {
  afterFlash,
  canPick,
  FLASH_MS,
  hint,
  hintedPlaces,
  HINT_PENALTY_MS,
  isOver,
  MAX_HINTS,
  newRun,
  pick,
  RUN_TRIOS,
  runTime,
  summary,
  trioNumber,
  WRONG_PENALTY_MS,
  type SoloRun,
  type TrioResult,
} from './run';
import styles from './solo-page.module.css';

/** Where the best run and the best of each day are kept. */
const BEST_KEY = 'trios:ten-trios';
/** How many days of bests a finished run lists. */
const DAYS_SHOWN = 3;

const isSeed = (value: string | null): value is string =>
  value !== null && SEED_PATTERN.test(value);

/**
 * TS01-TS04, TS11: Trios on your own, a run of ten trios against one clock.
 * `?seed=` is a challenge: the same first table and deck somebody else
 * played. It all runs here: nothing reaches the server.
 */
export function TriosSolo() {
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

/** TS01: what a run is, a trio to learn from, and the best on this device. */
function RunPicker({
  challenge,
  onStart,
}: {
  challenge: boolean;
  onStart: () => void;
}) {
  const game = gameInfo('trios');
  const best = readBest(BEST_KEY);
  const rule =
    'In a trio, each of colour, shape, count and fill is all the same or all different across the three cards. A wrong pick adds 5 seconds.';
  const description = challenge ? `A friend sent you this deal. ${rule}` : rule;

  return (
    <FormPage
      heading={{
        eyebrow: 'On your own',
        title: game.name,
        subtitle: game.solo?.summary,
      }}
      phone={{ eyebrow: game.name, subtitle: description }}
      title="Ten trios, one clock."
      description={description}
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onStart();
      }}
      actions={
        <>
          <Button type="submit">Start</Button>
          <ButtonLink to="/games" variant="secondary" icon="back">
            Back to games
          </ButtonLink>
        </>
      }
    >
      <div className={styles.example}>
        <MiniTrio cards={[0, 40, 80]} />
        <span className={styles.exampleText}>
          A trio: every feature differs.
        </span>
      </div>
      <StatList
        className={styles.stats}
        stats={[
          { label: 'Trios', value: String(RUN_TRIOS) },
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

/** TS02-TS04, TS11: the run, from the first table to its results. */
function RunView({
  seed,
  onPlayAgain,
}: {
  seed: string;
  onPlayAgain: () => void;
}) {
  const [run, setRun] = useState(() => newRun(seed, Date.now()));
  const [finish, setFinish] = useState<Finish | null>(null);
  const now = useClock(run.trioStartedAt !== null);

  // Three cards just judged stay up for a moment, then the run goes on.
  const flash = run.flash;
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => {
      const next = afterFlash(run, Date.now());
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
    }, FLASH_MS);
    return () => clearTimeout(timer);
  }, [flash, run]);

  const link = challengeLink(soloPath('trios'), { seed });

  if (finish) {
    const { timeMs, wrongPicks, hints, fastestMs } = summary(run);
    const time = formatDuration(timeMs);
    return (
      <SoloLayout
        gameType="trios"
        phase={{ tone: 'lime', label: 'Run complete' }}
        stage={
          <>
            <SoloResult
              title={`${RUN_TRIOS} trios in ${time}.`}
              body={finishBody(finish)}
              stats={[
                {
                  label: 'Wrong picks',
                  value: costOf(wrongPicks, WRONG_PENALTY_MS),
                },
                { label: 'Hints', value: costOf(hints, HINT_PENALTY_MS) },
                {
                  label: 'Fastest trio',
                  value:
                    fastestMs === null ? 'None' : formatDuration(fastestMs),
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
              <EveryTrio results={run.results} />
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
              description={`They get this same deal and try to beat ${time}.`}
              link={link}
            />
          </>
        }
      />
    );
  }

  const best = readBest(BEST_KEY);
  const { wrongPicks, hints } = summary(run);
  const label = `Trio ${trioNumber(run)} of ${RUN_TRIOS}`;
  return (
    <SoloLayout
      gameType="trios"
      phase={{ tone: 'blue', label }}
      stage={
        <>
          <TriosTurnBar lines={1} {...turnBar(run, now, label)} />
          <TablePanel>
            <TriosTable
              cards={run.deal.table}
              places={placesOf(run)}
              onPick={
                canPick(run)
                  ? (place) => setRun(pick(run, place, Date.now()))
                  : undefined
              }
            />
            {/* Offered until a trio's two hints are given; between trios
                it stays, so the table does not move. */}
            {run.hints < MAX_HINTS && (
              <TableTools>
                <Button variant="quiet" onClick={() => setRun(hint(run))}>
                  Hint, +10 s
                </Button>
              </TableTools>
            )}
          </TablePanel>
        </>
      }
      side={
        <>
          <Card kind="panel" title="This run">
            <StatList
              className={styles.stats}
              stats={[
                { label: 'Found', value: String(run.results.length) },
                {
                  label: 'Wrong picks',
                  value: costOf(wrongPicks + run.wrongPicks, WRONG_PENALTY_MS),
                },
                { label: 'Hints', value: String(hints + run.hints) },
              ]}
            />
          </Card>
          <Card kind="panel" title="Best on this device">
            <StatList
              className={styles.stats}
              stats={[
                {
                  label: 'Ten trios',
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

/** "1, +0:05". */
const costOf = (count: number, each: number) =>
  count ? `${count}, +${formatDuration(count * each)}` : '0';

/** What each place shows: the picks, three just judged, and the hints. */
function placesOf(run: SoloRun): Record<number, PlaceView> {
  const places: Record<number, PlaceView> = {};
  for (const place of hintedPlaces(run)) {
    places[place] = { badge: 'Hint', badgeLabel: 'hint' };
  }
  for (const place of run.picked) {
    places[place] = { ...places[place], state: 'selected' };
  }
  if (run.flash) {
    for (const place of run.flash.places) {
      places[place] = {
        ...places[place],
        state: run.flash.found ? 'found' : 'wrong',
      };
    }
  }
  return places;
}

function turnBar(run: SoloRun, now: number, label: string): TurnBarProps {
  const base = {
    label,
    kind: 'status' as const,
    countdown: {
      seconds: Math.floor(runTime(run, now) / 1000),
      label: 'run time',
      waiting: true,
    },
  };
  const flash = run.flash;
  if (flash?.found) {
    const last = run.results.at(-1)!;
    return {
      ...base,
      main: 'A trio!',
      meta: `Found in ${formatDuration(last.ms)}`,
    };
  }
  if (flash) {
    return {
      ...base,
      main: 'Not a trio, +5 s',
      meta:
        whyNotATrio(flash.places.map((place) => run.deal.table[place])) ??
        undefined,
    };
  }
  return {
    ...base,
    main:
      run.picked.length === 2
        ? 'Pick a third card'
        : run.picked.length === 1
          ? 'Pick two more'
          : 'Find a trio',
    meta: 'All the same or all different in every feature',
  };
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

/** "1 wrong pick", "2 hints", or both. */
function trioNote({ wrongPicks, hints }: TrioResult): string {
  return [
    wrongPicks ? plural(wrongPicks, 'wrong pick') : '',
    hints ? plural(hints, 'hint') : '',
  ]
    .filter(Boolean)
    .join(', ');
}

/** TS04: every trio of the run, and how long it took. */
function EveryTrio({ results }: { results: readonly TrioResult[] }) {
  return (
    <section className={styles.trios} aria-labelledby="every-trio">
      <h2 id="every-trio" className={styles.heading}>
        Every trio
      </h2>
      <ol className={styles.list}>
        {results.map((result, index) => (
          <li key={index} className={styles.trio}>
            <span className={styles.number}>{index + 1}</span>
            <MiniTrio cards={result.cards} />
            <span className={styles.note}>{trioNote(result)}</span>
            <span className={styles.time}>{formatDuration(result.ms)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
