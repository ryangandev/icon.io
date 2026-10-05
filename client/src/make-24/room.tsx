import { useState } from 'react';
import type {
  Make24HandResult,
  Make24RoomState,
} from '../../../shared/wire-types';
import { formatFraction, isTarget, type Step } from '../../../shared/make-24';
import { PickResult, TurnBar, type TurnBarProps } from '../ui';
import { plural } from '../games/plural';
import { useSecondsLeft } from '../net/use-seconds-left';
import { initialsOf, toneOf } from '../players/avatar';
import { EndedEarlyPanel, ResultsPanel, WaitingPanel } from '../room/panels';
import { listNames, rankedPlayers, type Seat } from '../room/players';
import { useRoomContext, type Room as RoomOf } from '../room/room-context';
import { RoomLayout, type PlayerLine } from '../room/room-layout';
import {
  cardsAfter,
  DealtCards,
  FinalCard,
  HandTable,
  StepList,
  TablePanel,
} from './table';
import styles from './room.module.css';

type Room = RoomOf<Make24RoomState>;

const SOLVED_CHAT = 'Solved! Chat opens when the hand ends.';

/** T06-T09, T12: a Make 24 room, before, during and after a game. */
export function Make24Room() {
  const room = useRoomContext<Make24RoomState>();
  const { state } = room;
  const players = rankedPlayers(state);
  const inGame = state.isGameStarted;
  const ended = !inGame ? state.lastGame : null;
  const solvedOpenHand = state.phase === 'solving' && state.mySolve !== null;
  return (
    <RoomLayout
      phase={
        inGame
          ? { tone: 'blue', label: `Hand ${state.hand} of ${state.hands}` }
          : ended && !ended.endedEarly
            ? { tone: 'lime', label: 'Game over' }
            : ended && players.length < 2
              ? { tone: 'peach', label: 'Game ended' }
              : { tone: 'blue', label: 'Waiting room' }
      }
      stage={
        inGame ? (
          // Each hand starts with nothing picked and no steps taken.
          <Hand key={state.hand} room={room} />
        ) : (
          <BetweenGames room={room} />
        )
      }
      players={players.map((seat) => playerLine(state, seat))}
      chat={{
        placeholder: 'Say something…',
        lockedReason: solvedOpenHand ? SOLVED_CHAT : undefined,
      }}
    />
  );
}

function BetweenGames({ room }: { room: Room }) {
  const { state, startGame, starting } = room;
  const count = Object.keys(state.playerList).length;
  const summary = state.lastGame;

  if (summary && !summary.endedEarly) {
    return (
      <>
        <ResultsPanel
          summary={summary}
          detail={`${plural(summary.hands, 'hand')}.`}
          onPlayAgain={startGame}
          starting={starting}
        />
        <HandResults state={state} />
      </>
    );
  }
  if (summary?.endedEarly && count < 2) return <EndedEarlyPanel />;
  return (
    <WaitingPanel
      aloneTitle="A little better with company."
      setup={`${plural(count, 'player')}, ${plural(state.hands, 'hand')}. Every hand, everyone gets the same four numbers at once, and quicker answers score more.`}
      guestSetup={`${plural(count, 'player')}, ${plural(state.hands, 'hand')}.`}
      onStart={startGame}
      starting={starting}
    />
  );
}

/** T06-T08, T12: one hand: the turn bar, then the table or its results. */
function Hand({ room }: { room: Room }) {
  const { state, receivedAt, reconnecting, socket } = room;
  const seconds = useSecondsLeft(state.phaseEndsInMs, receivedAt, reconnecting);
  const [steps, setSteps] = useState<readonly Step[]>([]);
  const cards = cardsAfter(state.deal, steps);
  const madeIt = cards.length === 1 && isTarget(cards[0].value);

  const step = (next: Step) => {
    const taken = [...steps, next];
    setSteps(taken);
    const after = cardsAfter(state.deal, taken);
    // The server replays the steps and says whether they count.
    if (after.length === 1 && isTarget(after[0].value)) {
      socket.emit('t24:solve', state.roomId, taken);
    }
  };

  if (state.phase === 'reveal') {
    return (
      <>
        <TurnBar {...turnBar(room, seconds, cards)} />
        <HandResults state={state} />
      </>
    );
  }

  const donePrompt =
    'Nice. The hand ends when everyone solves it or time runs out.';
  return (
    <>
      <TurnBar {...turnBar(room, seconds, cards)} />
      <TablePanel>
        {state.mySolve && !madeIt ? (
          // A refresh keeps the solve but not the steps that made it.
          <FinalCard
            value="24"
            formula={state.mySolve.expression}
            state="solved"
            prompt={donePrompt}
          />
        ) : (
          <HandTable
            deal={state.deal}
            steps={steps}
            onStep={step}
            onUndo={() => setSteps(steps.slice(0, -1))}
            onStartOver={() => setSteps([])}
            paused={reconnecting}
            done={madeIt ? donePrompt : undefined}
          />
        )}
        <StepList deal={state.deal} steps={steps} />
      </TablePanel>
    </>
  );
}

/** T08, T09: a finished hand's cards, and how everybody did. */
function HandResults({ state }: { state: Make24RoomState }) {
  const deal = state.lastDeal;
  // The hand the results belong to: the one being revealed, or the last of
  // a finished game.
  const hand = state.isGameStarted
    ? state.hand
    : (state.lastGame?.hands ?? state.hand);
  if (deal.length === 0) return null;
  return (
    <TablePanel>
      <DealtCards deal={deal} />
      <section className={styles.results} aria-labelledby="hand-results">
        <h2 id="hand-results" className={styles.resultsTitle}>
          Hand {hand} results
        </h2>
        <ul className={styles.resultList}>
          {state.lastHand.map((result) => (
            <PickResult
              key={result.playerId}
              name={result.username}
              initials={initialsOf(result.username)}
              tone={toneOf(result.username)}
              outcome={result.solved ? 'safe' : 'auto'}
              label={result.solved ? 'Solved' : 'Out of time'}
              detail={resultDetail(result)}
              points={result.points}
            />
          ))}
        </ul>
      </section>
    </TablePanel>
  );
}

/** "(8 − 6) × 3 × 4 · 46 s left", or "No answer". */
function resultDetail(result: Make24HandResult): string {
  return result.solved
    ? `${result.expression} · ${result.secondsLeft} s left`
    : 'No answer';
}

function turnBar(
  room: Room,
  seconds: number,
  cards: ReturnType<typeof cardsAfter>,
): TurnBarProps {
  const { state, playerId, reconnecting } = room;
  const clock = (label: string, waiting = false) =>
    reconnecting
      ? { seconds, label: 'paused', waiting: true }
      : { seconds, label, waiting };
  const label = `Hand ${state.hand} of ${state.hands}`;

  if (state.phase === 'reveal') {
    const mine = state.lastHand.find((result) => result.playerId === playerId);
    const base = {
      label: `${label} results`,
      kind: 'status' as const,
      countdown: clock(
        state.hand < state.hands ? 'next hand' : 'final scores',
        true,
      ),
    };
    if (mine?.solved) {
      return {
        ...base,
        main: `+${mine.points} for you`,
        meta: `Solved with ${plural(mine.secondsLeft, 'second')} left`,
      };
    }
    return {
      ...base,
      main: 'Out of time',
      meta: state.lastSolution
        ? `One way: ${state.lastSolution}`
        : 'Next hand in a moment',
    };
  }

  if (state.mySolve) {
    const waitingFor = Object.entries(state.playerList)
      .filter(
        ([id, player]) =>
          player.isConnected &&
          id !== playerId &&
          !state.solved.some((solve) => solve.playerId === id),
      )
      .map(([, player]) => player.username);
    return {
      label,
      kind: 'status',
      main: `Solved! +${state.mySolve.points}`,
      meta: waitingFor.length
        ? `Waiting for ${listNames(waitingFor)}`
        : 'Everyone solved it',
      countdown: clock('to solve'),
    };
  }
  if (cards.length === 1 && !isTarget(cards[0].value)) {
    return {
      label,
      kind: 'status',
      main: `That makes ${formatFraction(cards[0].value)}`,
      meta: 'Undo a step or start over',
      countdown: clock('to solve'),
    };
  }
  const solvers = state.solved.map((solve) => solve.username);
  return {
    label,
    kind: 'status',
    main: 'Make 24',
    meta: solvers.length
      ? `${listNames(solvers)} solved it`
      : 'Use each number once',
    countdown: clock('to solve'),
  };
}

/** One player's line on the scoreboard. */
function playerLine(state: Make24RoomState, seat: Seat): PlayerLine {
  if (!seat.isConnected) {
    return { seat, status: 'Away', statusIcon: 'away', state: 'away' };
  }
  if (!state.isGameStarted) return { seat, status: 'Waiting' };
  if (state.phase === 'reveal') {
    const result = state.lastHand.find((r) => r.playerId === seat.playerId);
    if (!result) return { seat, status: 'Waiting' };
    return result.solved
      ? { seat, status: `Solved · +${result.points}`, statusIcon: 'check' }
      : { seat, status: 'Out of time', statusIcon: 'clock' };
  }
  const solve = state.solved.find((s) => s.playerId === seat.playerId);
  return solve
    ? {
        seat,
        status: `Solved · +${solve.points}`,
        statusIcon: 'check',
        state: 'scored',
      }
    : { seat, status: 'Solving' };
}
