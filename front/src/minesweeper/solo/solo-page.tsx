import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import type { MinesweeperDifficulty } from '../../../../shared/wire-types';
import { BOARD_SIZES, DIFFICULTIES } from '../../../../shared/minesweeper';
import {
  Button,
  ButtonLink,
  Card,
  ChoiceList,
  StatList,
  TurnBar,
  type MineCellState,
  type TurnBarProps,
} from '../../ui';
import { gameInfo } from '../../games/catalog';
import { plural } from '../../games/plural';
import { useSession } from '../../net/session';
import { FormPage } from '../../shell/form-page';
import { PHONE, useMediaQuery } from '../../shell/use-media-query';
import {
  formatDuration,
  readBest,
  readStored,
  recordBest,
  writeStored,
} from '../../solo/device-store';
import { SoloLayout } from '../../solo/solo-layout';
import { SoloResult } from '../../solo/solo-result';
import { useClock } from '../../solo/use-clock';
import { MineGrid } from '../board';
import {
  cellAt,
  chord,
  elapsed,
  minesLeft,
  minesStillHidden,
  newGame,
  reveal,
  toggleFlag,
  type SoloGame,
} from './game';
import styles from './solo-page.module.css';

const LAST_BOARD = 'minesweeper:board';
const bestKey = (difficulty: MinesweeperDifficulty) =>
  `minesweeper:${difficulty}`;

const isDifficulty = (value: string | null): value is MinesweeperDifficulty =>
  DIFFICULTIES.includes(value as MinesweeperDifficulty);

/** "Medium · 16 × 16". */
function boardLabel(difficulty: MinesweeperDifficulty): string {
  const { width, height } = BOARD_SIZES[difficulty];
  return `${difficulty} · ${width} × ${height}`;
}

/**
 * MS01-MS05: Minesweeper on your own. Without a board in the address it asks
 * for one; `?board=Medium` plays one. It all runs here: nothing reaches the
 * server, and there is no name to ask for.
 */
export function MinesweeperSolo() {
  const [params, setParams] = useSearchParams();
  const board = params.get('board');
  // Each new game is a fresh mount, so nothing carries over from the last.
  const [run, setRun] = useState(0);

  if (!isDifficulty(board)) {
    return (
      <BoardPicker
        onStart={(difficulty) => {
          writeStored(LAST_BOARD, difficulty);
          setParams({ board: difficulty });
        }}
      />
    );
  }
  return (
    <SoloGameView
      key={`${board}:${run}`}
      difficulty={board}
      onPlayAgain={() => setRun((count) => count + 1)}
      onChangeBoard={() => setParams({})}
    />
  );
}

/** MS01: the three boards, each with its best on this device. */
function BoardPicker({
  onStart,
}: {
  onStart: (difficulty: MinesweeperDifficulty) => void;
}) {
  const game = gameInfo('minesweeper');
  const { name } = useSession();
  const [difficulty, setDifficulty] = useState<MinesweeperDifficulty>(() => {
    const last = readStored(LAST_BOARD);
    return isDifficulty(last) ? last : 'Small';
  });
  const description =
    'Your first click is always safe. The clock starts with it.';

  return (
    <FormPage
      heading={{
        eyebrow: 'On your own',
        title: game.name,
        subtitle: game.solo?.summary,
      }}
      phone={{ eyebrow: game.name, subtitle: description }}
      title="Pick a board."
      description={description}
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onStart(difficulty);
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
      <ChoiceList
        label="Board"
        options={DIFFICULTIES.map((board) => {
          const best = readBest(bestKey(board));
          return {
            value: board,
            label: boardLabel(board),
            detail: `${BOARD_SIZES[board].mines} mines. ${
              best === null ? 'No best yet' : `Best: ${formatDuration(best)}`
            }`,
          };
        })}
        value={difficulty}
        onValueChange={setDifficulty}
      />
    </FormPage>
  );
}

/** How a won game compares with the best before it. */
type Finish = { time: number; previous: number | null; isBest: boolean };

/** MS02-MS05: one board, from the first click to a win or a mine. */
function SoloGameView({
  difficulty,
  onPlayAgain,
  onChangeBoard,
}: {
  difficulty: MinesweeperDifficulty;
  onPlayAgain: () => void;
  onChangeBoard: () => void;
}) {
  const phone = useMediaQuery(PHONE);
  const [game, setGame] = useState(() => newGame(difficulty));
  const [flagMode, setFlagMode] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(null);
  const now = useClock(game.status === 'playing');
  const over = game.status === 'won' || game.status === 'lost';

  const play = (next: SoloGame) => {
    if (next === game) return;
    setGame(next);
    if (next.status === 'won') {
      const time = elapsed(next, Date.now());
      setFinish({ time, ...recordBest(bestKey(difficulty), time) });
    }
  };

  const cell = (index: number) => {
    const shown = cellAt(game, index);
    const state = cellState(shown);
    if (over) return { state };
    const flag = () => play(toggleFlag(game, index));
    if (shown === 'hidden' || shown === 'flag') {
      return {
        state,
        // A flag is lifted, never opened, by a plain click.
        onPick: flagMode
          ? flag
          : shown === 'hidden'
            ? () => play(reveal(game, index, Date.now()))
            : undefined,
        onMark: flag,
      };
    }
    if (typeof shown === 'number' && shown > 0) {
      return { state, onPick: () => play(chord(game, index, Date.now())) };
    }
    return { state };
  };

  const tryAgain = (
    <>
      <Button onClick={onPlayAgain}>Try again</Button>
      <Button variant="secondary" onClick={onChangeBoard}>
        Change board
      </Button>
    </>
  );

  const stage = (
    <>
      {finish ? (
        <SoloResult
          title={`Cleared in ${formatDuration(finish.time)}.`}
          body={finishBody(difficulty, finish)}
          stats={[
            { label: 'Time', value: formatDuration(finish.time) },
            { label: 'Board', value: boardLabel(difficulty) },
            { label: 'Mines', value: String(game.mines) },
          ]}
          actions={
            <>
              <Button onClick={onPlayAgain}>Play again</Button>
              <Button variant="secondary" onClick={onChangeBoard}>
                Change board
              </Button>
            </>
          }
        />
      ) : (
        <TurnBar {...turnBar(game, now, flagMode, phone)} />
      )}
      <div className={styles.boardPanel}>
        <MineGrid width={game.width} height={game.height} cell={cell} />
        {!over && (
          <div className={styles.mode} role="group" aria-label="A click">
            <Button
              variant={flagMode ? 'secondary' : 'primary'}
              aria-pressed={!flagMode}
              onClick={() => setFlagMode(false)}
            >
              Reveal
            </Button>
            <Button
              variant={flagMode ? 'primary' : 'secondary'}
              icon="flag"
              aria-pressed={flagMode}
              onClick={() => setFlagMode(true)}
            >
              Flag
            </Button>
          </div>
        )}
        {phone && game.status === 'lost' && (
          <div className={styles.mode}>{tryAgain}</div>
        )}
      </div>
    </>
  );

  return (
    <SoloLayout
      gameType="minesweeper"
      phase={
        game.status === 'won'
          ? { tone: 'lime', label: 'Board cleared' }
          : { tone: 'blue', label: boardLabel(difficulty) }
      }
      stage={stage}
      side={
        <>
          {game.status === 'lost' ? (
            <Card
              kind="panel"
              title="Try again?"
              description={`A new ${difficulty} board. Your first click is safe again.`}
              actions={tryAgain}
            />
          ) : (
            game.status !== 'won' && (
              <Card kind="panel" title="This game">
                <StatList
                  className={styles.stats}
                  stats={[
                    { label: 'Mines', value: String(game.mines) },
                    {
                      label: 'Flags',
                      value: String(game.flags.filter(Boolean).length),
                    },
                    {
                      label: 'Safe cells left',
                      value: String(
                        game.width * game.height -
                          game.mines -
                          game.open.filter(Boolean).length,
                      ),
                    },
                  ]}
                />
              </Card>
            )
          )}
          <Card kind="panel" title="Best on this device">
            <StatList
              className={styles.stats}
              stats={DIFFICULTIES.map((board) => {
                const best = readBest(bestKey(board));
                return {
                  label: boardLabel(board),
                  value: best === null ? 'Not yet' : formatDuration(best),
                  tone:
                    best === null
                      ? 'muted'
                      : board === difficulty && finish?.isBest
                        ? 'green'
                        : undefined,
                };
              })}
            />
          </Card>
        </>
      }
    />
  );
}

function cellState(shown: ReturnType<typeof cellAt>): MineCellState {
  return typeof shown === 'number'
    ? { kind: 'open', adjacent: shown }
    : { kind: shown };
}

function finishBody(difficulty: MinesweeperDifficulty, finish: Finish): string {
  if (finish.previous === null) {
    return `Your first ${difficulty} board cleared on this device.`;
  }
  return finish.isBest
    ? `A new best on this device. Your last best on ${difficulty} was ${formatDuration(finish.previous)}.`
    : `Your best on ${difficulty} is ${formatDuration(finish.previous)}.`;
}

/** "30 mines left", "1 mine left", "−2 mines left": flags can outrun mines. */
function minesLeftLine(count: number): string {
  const number = count < 0 ? `−${-count}` : String(count);
  return `${number} ${Math.abs(count) === 1 ? 'mine' : 'mines'} left`;
}

function turnBar(
  game: SoloGame,
  now: number,
  flagMode: boolean,
  phone: boolean,
): TurnBarProps {
  const countdown = {
    seconds: Math.floor(elapsed(game, now) / 1000),
    label: 'run time',
    waiting: true,
  };
  if (game.status === 'lost') {
    const hidden = minesStillHidden(game);
    return {
      label: 'Game over',
      kind: 'status',
      main: 'You hit a mine',
      meta: `${plural(hidden, 'mine')} ${hidden === 1 ? 'was' : 'were'} still hidden`,
      countdown,
    };
  }
  return {
    label: 'Clear the board',
    kind: 'status',
    main: minesLeftLine(minesLeft(game)),
    meta: flagMode
      ? `Flag mode: a ${phone ? 'tap' : 'click'} flags`
      : game.status === 'ready'
        ? 'Your first click is always safe'
        : phone
          ? 'Long-press to flag'
          : 'Right-click or long-press to flag',
    countdown,
  };
}
