import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import {
  dailyAnswer,
  GUESS_PROBLEM_TEXT,
  MAX_GUESSES,
  msUntilNextPuzzle,
  practiceAnswer,
  puzzleNumber,
  shareText,
} from '../../../../shared/daily-word';
import { newSeed, SEED_PATTERN } from '../../../../shared/seed';
import {
  Button,
  Card,
  StatList,
  TurnBar,
  WordBoard,
  type TurnBarProps,
} from '../../ui';
import { soloPath } from '../../games/catalog';
import { listNames } from '../../room/players';
import { useCopy } from '../../shell/use-copy';
import { PHONE, useMediaQuery } from '../../shell/use-media-query';
import { challengeLink } from '../../solo/challenge';
import { SoloLayout } from '../../solo/solo-layout';
import { SoloResult } from '../../solo/solo-result';
import { useClock } from '../../solo/use-clock';
import { BoardPanel, MarkLegend } from '../panel';
import { PlayArea } from '../play';
import { Distribution } from './distribution';
import {
  deleteLetter,
  guessesToWin,
  isOver,
  newGame,
  rowsOf,
  submit,
  typeLetter,
  type SoloGame,
} from './game';
import {
  readRecords,
  recordGuesses,
  statsOf,
  type DailyStats,
} from './records';
import styles from './solo-page.module.css';

const isSeed = (value: string | null): value is string =>
  value !== null && SEED_PATTERN.test(value);

type Mode = { kind: 'daily' } | { kind: 'practice'; seed: string };

/**
 * DW01-DW06, DW12: Daily Word on your own. Today's word first; practice words
 * after it. `?seed=` is a challenge: a practice word somebody else played,
 * straight away. It all runs here: nothing reaches the server.
 */
export function DailyWordSolo() {
  const [params, setParams] = useSearchParams();
  const linked = params.get('seed');
  const [mode, setMode] = useState<Mode>(() =>
    isSeed(linked) ? { kind: 'practice', seed: linked } : { kind: 'daily' },
  );
  const [puzzle, setPuzzle] = useState(() => puzzleNumber(new Date()));
  const practice = () => setMode({ kind: 'practice', seed: newSeed() });
  const nextDay = useCallback(() => setPuzzle(puzzleNumber(new Date())), []);

  if (mode.kind === 'daily') {
    return (
      <DailyView
        key={puzzle}
        puzzle={puzzle}
        onPractice={practice}
        onNextDay={nextDay}
      />
    );
  }
  return (
    <PracticeView
      key={mode.seed}
      seed={mode.seed}
      challenge={mode.seed === linked}
      onAnother={practice}
      onToday={() => {
        // A challenge is played once; a refresh now goes to today's word.
        if (linked !== null) setParams({}, { replace: true });
        setPuzzle(puzzleNumber(new Date()));
        setMode({ kind: 'daily' });
      }}
    />
  );
}

const two = (n: number) => String(n).padStart(2, '0');

/** "9:41:18": the time to the next word. */
export function formatWait(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}:${two(minutes)}:${two(seconds % 60)}`;
}

/** The typing a board takes, as one game changes into the next. */
function useSoloGame(
  start: () => SoloGame,
  onGuess?: (game: SoloGame) => void,
) {
  const [game, setGame] = useState(start);
  const typing = {
    onLetter: (letter: string) => setGame(typeLetter(game, letter)),
    onDelete: () => setGame(deleteLetter(game)),
    onEnter: () => {
      const next = submit(game);
      setGame(next);
      if (next.guesses !== game.guesses) onGuess?.(next);
    },
  };
  return { game, setGame, typing };
}

/** A day's word, with the guesses this device has made at it. */
const dailyGame = (puzzle: number) =>
  newGame(dailyAnswer(puzzle), readRecords().get(puzzle) ?? []);

/** DW01-DW05, DW12: today's word, then how it went. */
function DailyView({
  puzzle,
  onPractice,
  onNextDay,
}: {
  puzzle: number;
  onPractice: () => void;
  /** Midnight came while the finished word was on screen. */
  onNextDay: () => void;
}) {
  const [records, setRecords] = useState(readRecords);
  const { game, typing } = useSoloGame(
    () => dailyGame(puzzle),
    (next) => setRecords(recordGuesses(puzzle, next.guesses)),
  );
  const over = isOver(game);
  const now = useClock(over);

  // A finished word gives way to the next one at midnight; one being played
  // stays until it is done.
  useEffect(() => {
    if (!over) return;
    const timer = setTimeout(onNextDay, msUntilNextPuzzle(new Date()) + 1000);
    return () => clearTimeout(timer);
  }, [over, onNextDay]);

  const stats = statsOf(records, puzzle);
  const phase = { tone: 'blue' as const, label: `Word #${puzzle}` };
  const title = `Daily word #${puzzle}`;

  if (!over) {
    return (
      <SoloLayout
        gameType="daily-word"
        phase={phase}
        stage={
          <>
            <TurnBar
              {...playingBar(game, title, 'Six guesses. A new word every day.')}
            />
            <BoardPanel>
              <PlayArea
                rows={rowsOf(game)}
                typed={game.typed}
                problem={game.problem && GUESS_PROBLEM_TEXT[game.problem]}
                prompt={
                  game.guesses.length === 0
                    ? 'Type a five-letter word, then press Enter.'
                    : 'Enter checks the word. Backspace takes a letter back.'
                }
                typing={typing}
                keyboard
              />
            </BoardPanel>
          </>
        }
        side={
          <>
            <Card kind="panel" title="How to read it">
              <MarkLegend />
            </Card>
            <DeviceStats stats={stats} />
          </>
        }
      />
    );
  }

  const found = guessesToWin(game);
  const word = game.answer.toUpperCase();
  const share = shareText(
    `Daily Word #${puzzle}`,
    rowsOf(game).map((row) => row.marks),
    `${window.location.origin}${soloPath('daily-word')}`,
  );
  return (
    <FinishedLayout
      phase={phase}
      result={
        <SoloResult
          title={found ? `Found in ${found}.` : 'Not this time.'}
          body={
            found
              ? `The word was ${word}. ${streakLine(stats.currentStreak)}`
              : `The word was ${word}. A new streak starts tomorrow.`
          }
          stats={[
            {
              label: 'Guesses',
              value: `${game.guesses.length} of ${MAX_GUESSES}`,
            },
            {
              label: 'Next word in',
              value: formatWait(msUntilNextPuzzle(new Date(now))),
            },
          ]}
          actions={
            <>
              <CopyButton text={share} label="Share" icon="copy" primary />
              <Button variant="secondary" onClick={onPractice}>
                Practice word
              </Button>
            </>
          }
        />
      }
      game={game}
      side={
        <>
          <DeviceStats stats={stats} />
          <Card kind="panel" title="Guesses to find it">
            <Distribution counts={stats.distribution} today={found} />
          </Card>
        </>
      }
    />
  );
}

const streakLine = (streak: number) =>
  streak > 1 ? `That makes ${streak} days in a row.` : 'That starts a streak.';

/** DW06: a practice word, and how it went. */
function PracticeView({
  seed,
  challenge,
  onAnother,
  onToday,
}: {
  seed: string;
  /** Opened from somebody else's link. */
  challenge: boolean;
  onAnother: () => void;
  onToday: () => void;
}) {
  const { game, typing } = useSoloGame(() => newGame(practiceAnswer(seed)));
  const phase = {
    tone: 'blue' as const,
    label: challenge ? 'Challenge' : 'Practice',
  };

  if (!isOver(game)) {
    return (
      <SoloLayout
        gameType="daily-word"
        phase={phase}
        stage={
          <>
            <TurnBar
              {...playingBar(
                game,
                challenge ? 'A friend’s word' : 'Practice word',
                challenge
                  ? 'A friend sent you this word. Six guesses.'
                  : 'Six guesses. Practice keeps no stats.',
              )}
            />
            <BoardPanel>
              <PlayArea
                rows={rowsOf(game)}
                typed={game.typed}
                problem={game.problem && GUESS_PROBLEM_TEXT[game.problem]}
                typing={typing}
                keyboard
              />
            </BoardPanel>
          </>
        }
        side={
          <Card kind="panel" title="How to read it">
            <MarkLegend />
          </Card>
        }
      />
    );
  }

  const found = guessesToWin(game);
  const marks = rowsOf(game).map((row) => row.marks);
  const share = shareText(
    'Daily Word practice',
    marks,
    challengeLink(soloPath('daily-word'), { seed }),
  );
  return (
    <FinishedLayout
      phase={phase}
      result={
        <SoloResult
          title={found ? `Found in ${found}.` : 'Not this time.'}
          body={`The word was ${game.answer.toUpperCase()}. Practice words keep no stats.`}
          actions={
            <>
              <Button onClick={onAnother}>Another word</Button>
              <CopyButton text={share} label="Challenge a friend" icon="link" />
              <Button variant="quiet" icon="back" onClick={onToday}>
                Today’s word
              </Button>
            </>
          }
        />
      }
      game={game}
      side={
        <Card
          kind="panel"
          title="Challenge a friend"
          description={
            found
              ? `They get this same word and try to find it in fewer than ${found} guesses. They see your marks, not your letters.`
              : 'They get this same word. They see your marks, not your letters.'
          }
        >
          <WordBoard
            rows={rowsOf(game).map(({ marks: m }) => ({
              word: null,
              marks: m,
            }))}
            size="mini"
            label="Your marks"
          />
          <CopyButton
            text={share}
            label="Copy challenge"
            icon="link"
            className={styles.copy}
          />
        </Card>
      }
    />
  );
}

/** DW04-DW06: the result over the finished board, and cards beside it. */
function FinishedLayout({
  phase,
  result,
  game,
  side,
}: {
  phase: { tone: 'blue'; label: string };
  result: ReactNode;
  game: SoloGame;
  side: ReactNode;
}) {
  const phone = useMediaQuery(PHONE);
  return (
    <SoloLayout
      gameType="daily-word"
      phase={phase}
      stage={
        <>
          {result}
          <BoardPanel>
            <WordBoard
              rows={rowsOf(game)}
              size={phone ? 'compact' : 'regular'}
              label="Your guesses"
            />
          </BoardPanel>
          {/* A phone has no column beside the board, so the cards follow it. */}
          {phone && side}
        </>
      }
      side={side}
    />
  );
}

function DeviceStats({ stats }: { stats: DailyStats }) {
  return (
    <Card kind="panel" title="On this device">
      <StatList
        className={styles.stats}
        stats={[
          { label: 'Played', value: String(stats.played) },
          { label: 'Found', value: `${stats.foundPercent}%` },
          { label: 'Current streak', value: String(stats.currentStreak) },
          { label: 'Best streak', value: String(stats.bestStreak) },
        ]}
      />
    </Card>
  );
}

/** Copies a result to paste anywhere, and says so for a moment. */
function CopyButton({
  text,
  label,
  icon,
  primary = false,
  className,
}: {
  text: string;
  label: string;
  icon: 'copy' | 'link';
  primary?: boolean;
  className?: string;
}) {
  const { copied, copy } = useCopy(text);
  return (
    <Button
      variant={primary ? 'primary' : 'secondary'}
      icon={copied ? 'check' : icon}
      onClick={copy}
      className={className}
    >
      {copied ? 'Copied' : label}
    </Button>
  );
}

/** The turn bar while a word is played: which guess, and what is known. */
function playingBar(
  game: SoloGame,
  label: string,
  fresh: string,
): TurnBarProps {
  if (game.guesses.length === 0) {
    return { label, kind: 'status', main: 'Find the word', meta: fresh };
  }
  return {
    label,
    kind: 'status',
    main: `Guess ${game.guesses.length + 1} of ${MAX_GUESSES}`,
    meta: game.problem ? 'Fix the row and try again' : known(game),
  };
}

/** "A, L and T". */
const listLetters = (letters: Set<string>) => listNames([...letters]);

/** "A and L are in place, T is somewhere else". */
export function known(game: SoloGame): string {
  const placed = new Set<string>();
  const elsewhere = new Set<string>();
  for (const { word, marks } of rowsOf(game)) {
    marks.forEach((mark, index) => {
      if (mark === 'correct') placed.add(word[index].toUpperCase());
    });
  }
  for (const { word, marks } of rowsOf(game)) {
    marks.forEach((mark, index) => {
      const letter = word[index].toUpperCase();
      if (mark === 'present' && !placed.has(letter)) elsewhere.add(letter);
    });
  }
  const parts: string[] = [];
  if (placed.size)
    parts.push(
      `${listLetters(placed)} ${placed.size > 1 ? 'are' : 'is'} in place`,
    );
  if (elsewhere.size)
    parts.push(
      `${listLetters(elsewhere)} ${elsewhere.size > 1 ? 'are' : 'is'} somewhere else`,
    );
  return parts.length ? parts.join(', ') : 'None of those letters are in it';
}
