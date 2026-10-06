import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import type { PairsBoard } from '../../../../shared/wire-types';
import { PAIRS_BOARDS } from '../../../../shared/pairs';
import { newSeed, SEED_PATTERN } from '../../../../shared/seed';
import {
  Button,
  ButtonLink,
  Card,
  ChoiceList,
  StatList,
  TurnBar,
  type Stat,
  type TurnBarProps,
} from '../../ui';
import { gameInfo, soloPath } from '../../games/catalog';
import { plural } from '../../games/plural';
import { FormPage } from '../../shell/form-page';
import { PHONE, useMediaQuery } from '../../shell/use-media-query';
import {
  ChallengeButton,
  ChallengeCard,
  challengeLink,
} from '../../solo/challenge';
import {
  formatDuration,
  readStored,
  writeStored,
} from '../../solo/device-store';
import { SoloLayout } from '../../solo/solo-layout';
import { SoloResult } from '../../solo/solo-result';
import { useClock } from '../../solo/use-clock';
import { BoardPanel, PairsGrid } from '../board';
import { boardLabel, BOARDS } from '../boards';
import { readPairsBest, recordPairsBest, type PairsBest } from './best';
import {
  cardsOf,
  elapsed,
  flip,
  isOver,
  isShowingMiss,
  lastTurn,
  MISS_SHOWN_MS,
  newGame,
  pairsFound,
  summary,
  turnBack,
  type SoloGame,
} from './game';
import styles from './solo-page.module.css';

const LAST_BOARD = 'pairs:board';

const isBoard = (value: string | null): value is PairsBoard =>
  BOARDS.includes(value as PairsBoard);
const isSeed = (value: string | null): value is string =>
  value !== null && SEED_PATTERN.test(value);

/** "31 turns". */
const turnsLabel = (best: PairsBest) => plural(best.turns, 'turn');

/**
 * PR01-PR04, PR09: Pairs on your own. `?board=Large&seed=k3f9x2` is a
 * challenge: the same deck somebody else played. It all runs here: nothing
 * reaches the server.
 */
export function PairsSolo() {
  const [params, setParams] = useSearchParams();
  const linkedBoard = params.get('board');
  const linkedSeed = params.get('seed');
  const challenge =
    isBoard(linkedBoard) && isSeed(linkedSeed)
      ? { board: linkedBoard, seed: linkedSeed }
      : null;
  // Each game is a fresh mount, so nothing carries over from the last.
  const [playing, setPlaying] = useState<{
    board: PairsBoard;
    seed: string;
    game: number;
  } | null>(null);

  if (playing === null) {
    return (
      <BoardPicker
        challenge={challenge?.board ?? null}
        onStart={(board) => {
          writeStored(LAST_BOARD, board);
          setPlaying({
            board,
            seed: challenge?.seed ?? newSeed(),
            game: 0,
          });
        }}
      />
    );
  }
  return (
    <SoloGameView
      key={playing.game}
      board={playing.board}
      seed={playing.seed}
      onPlayAgain={() => {
        // A challenge is played once; the next game is a new deck.
        if (challenge) setParams({}, { replace: true });
        setPlaying({ ...playing, seed: newSeed(), game: playing.game + 1 });
      }}
    />
  );
}

/** PR01: the two boards, each with its best on this device. */
function BoardPicker({
  challenge,
  onStart,
}: {
  /** The board a challenge link deals, the only one to play. */
  challenge: PairsBoard | null;
  onStart: (board: PairsBoard) => void;
}) {
  const game = gameInfo('pairs');
  const [board, setBoard] = useState<PairsBoard>(() => {
    if (challenge) return challenge;
    const last = readStored(LAST_BOARD);
    return isBoard(last) ? last : 'Small';
  });
  const description = challenge
    ? 'A friend sent you this deck. Fewer turns is better. Your time is kept too.'
    : 'Fewer turns is better. Your time is kept too.';

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
        onStart(board);
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
      <ChoiceList
        label="Board"
        options={(challenge ? [challenge] : BOARDS).map((option) => {
          const best = readPairsBest(option);
          return {
            value: option,
            label: boardLabel(option),
            detail: `${PAIRS_BOARDS[option].pairs} pairs. ${
              best === null ? 'No best yet' : `Best: ${turnsLabel(best)}`
            }`,
          };
        })}
        value={board}
        onValueChange={setBoard}
      />
    </FormPage>
  );
}

/** How a cleared board compares with the best before it. */
interface Finish {
  previous: PairsBest | null;
  isBest: boolean;
}

/** PR02-PR04, PR09: one deck, from the first card to the last pair. */
function SoloGameView({
  board,
  seed,
  onPlayAgain,
}: {
  board: PairsBoard;
  seed: string;
  onPlayAgain: () => void;
}) {
  const phone = useMediaQuery(PHONE);
  const [game, setGame] = useState(() => newGame(board, seed));
  const [finish, setFinish] = useState<Finish | null>(null);
  const now = useClock(game.startedAt !== null && !isOver(game));
  // Each miss is its own pair of places, so the next one starts its own wait.
  const miss = isShowingMiss(game) ? game.up : null;

  // Two cards that do not match stay up a moment, unless another is flipped.
  useEffect(() => {
    if (!miss) return;
    const timer = setTimeout(
      () =>
        setGame((current) =>
          current.up === miss ? turnBack(current) : current,
        ),
      MISS_SHOWN_MS,
    );
    return () => clearTimeout(timer);
  }, [miss]);

  const play = (index: number) => {
    const next = flip(game, index, Date.now());
    if (next === game) return;
    setGame(next);
    if (isOver(next)) {
      const { turns, timeMs } = summary(next, Date.now());
      setFinish(recordPairsBest(board, { turns, ms: timeMs }));
    }
  };

  const link = challengeLink(soloPath('pairs'), { board, seed });
  const { pairs, turns, timeMs, streak } = summary(game, now);

  const bests: Stat[] = BOARDS.map((option) => {
    const best = readPairsBest(option);
    return {
      label: boardLabel(option),
      value: best === null ? 'Not yet' : turnsLabel(best),
      tone:
        best === null
          ? 'muted'
          : option === board && finish?.isBest
            ? 'green'
            : undefined,
    };
  });

  return (
    <SoloLayout
      gameType="pairs"
      phase={
        finish
          ? { tone: 'lime', label: 'Board cleared' }
          : { tone: 'blue', label: boardLabel(board) }
      }
      stage={
        <>
          {finish ? (
            <SoloResult
              title={`${pairs} pairs in ${plural(turns, 'turn')}.`}
              body={finishBody(board, turns, finish)}
              stats={[
                { label: 'Time', value: formatDuration(timeMs) },
                { label: 'Turns', value: String(turns) },
                {
                  label: 'Longest streak',
                  value: `${plural(streak, 'pair')} in a row`,
                },
              ]}
              actions={
                <>
                  <Button onClick={onPlayAgain}>Play again</Button>
                  <ChallengeButton link={link} />
                </>
              }
            />
          ) : (
            <TurnBar {...turnBar(game, now, phone)} />
          )}
          <BoardPanel>
            <PairsGrid
              cards={cardsOf(game)}
              onFlip={finish ? undefined : play}
            />
          </BoardPanel>
        </>
      }
      side={
        finish ? (
          <>
            <Card kind="panel" title="Best on this device">
              <StatList className={styles.stats} stats={bests} />
            </Card>
            <ChallengeCard
              description={`They get this same deck and try to beat ${plural(turns, 'turn')}.`}
              link={link}
            />
          </>
        ) : (
          <>
            <Card kind="panel" title="This game">
              <StatList
                className={styles.stats}
                stats={[
                  {
                    label: 'Pairs',
                    value: `${pairsFound(game)} of ${pairs}`,
                  },
                  { label: 'Turns', value: String(turns) },
                ]}
              />
            </Card>
            <Card kind="panel" title="Best on this device">
              <StatList className={styles.stats} stats={bests} />
            </Card>
          </>
        )
      }
    />
  );
}

function finishBody(board: PairsBoard, turns: number, finish: Finish): string {
  const { previous, isBest } = finish;
  if (previous === null) {
    return `Your first ${board} board cleared on this device.`;
  }
  // The same turns as the best is told apart by the time.
  const best =
    previous.turns === turns
      ? `${turnsLabel(previous)} in ${formatDuration(previous.ms)}`
      : turnsLabel(previous);
  return isBest
    ? `A new best on this device. Your last best was ${best}.`
    : `Your best on ${board} is ${best}.`;
}

function turnBar(game: SoloGame, now: number, phone: boolean): TurnBarProps {
  const turns = game.turns.length;
  const flipping = game.up.length === 1;
  const last = lastTurn(game);
  // A finished turn stays up, with its number, until the next card is
  // flipped: a pair, or a miss until it turns back.
  const finished =
    isShowingMiss(game) || (last === 'pair' && game.up.length === 0);
  const number = finished ? turns : turns + 1;
  const pairs = PAIRS_BOARDS[game.board].pairs;
  const base = {
    label: `Turn ${number}`,
    kind: 'status' as const,
    countdown: {
      seconds: Math.floor(elapsed(game, now) / 1000),
      label: 'run time',
      waiting: true,
    },
  };
  // A phone has no side cards, so the pairs found are on the turn bar.
  const progress = `${pairsFound(game)} of ${pairs} pairs`;
  if (flipping) {
    return {
      ...base,
      main: 'Find its pair',
      meta: phone ? progress : 'Where did you see it?',
    };
  }
  if (isShowingMiss(game)) {
    return {
      ...base,
      main: 'Not a pair',
      meta: phone ? progress : 'They flip back in a moment',
    };
  }
  if (finished) {
    return {
      ...base,
      main: 'A pair!',
      meta: phone ? progress : 'Flip another card',
    };
  }
  return {
    ...base,
    main: 'Flip a card',
    meta: phone
      ? progress
      : game.startedAt === null
        ? 'The clock starts with your first card'
        : 'Then find its pair',
  };
}
