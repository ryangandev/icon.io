import { useState } from 'react';
import type {
  DailyWordBoard,
  DailyWordRoomState,
} from '../../../shared/wire-types';
import {
  checkGuess,
  GUESS_PROBLEM_TEXT,
  MAX_GUESSES,
} from '../../../shared/daily-word';
import { RaceBoard, TurnBar, type TurnBarProps } from '../ui';
import { plural } from '../games/plural';
import { REQUEST_TIMEOUT_MS } from '../net/socket';
import { useSecondsLeft } from '../net/use-seconds-left';
import { EndedEarlyPanel, ResultsPanel, WaitingPanel } from '../room/panels';
import { listNames, rankedPlayers, type Seat } from '../room/players';
import { useRoomContext, type Room as RoomOf } from '../room/room-context';
import { RoomLayout, type PlayerLine } from '../room/room-layout';
import { PHONE, useMediaQuery } from '../shell/use-media-query';
import { BoardPanel } from './panel';
import { PlayArea } from './play';
import styles from './room.module.css';

type Room = RoomOf<DailyWordRoomState>;

const FOUND_CHAT = 'You got it. Chat opens after the reveal.';

/** DW07-DW10, DW13, DW14: a Daily Word room, before, during and after a game. */
export function DailyWordRoom() {
  const room = useRoomContext<DailyWordRoomState>();
  const { state, playerId } = room;
  const phone = useMediaQuery(PHONE);
  const players = rankedPlayers(state);
  const inGame = state.isGameStarted;
  const ended = !inGame ? state.lastGame : null;
  const mine = state.boards.find((board) => board.playerId === playerId);
  const guessing = state.phase === 'guessing';
  return (
    <RoomLayout
      phase={
        inGame
          ? { tone: 'blue', label: `Word ${state.round} of ${state.rounds}` }
          : ended && !ended.endedEarly
            ? { tone: 'lime', label: 'Game over' }
            : ended && players.length < 2
              ? { tone: 'peach', label: 'Game ended' }
              : { tone: 'blue', label: 'Waiting room' }
      }
      stage={
        inGame ? (
          // Each word starts with nothing typed.
          <Round key={state.round} room={room} />
        ) : (
          <BetweenGames room={room} />
        )
      }
      players={players.map((seat) => playerLine(state, seat))}
      chat={{
        placeholder: 'Say something…',
        lockedReason:
          guessing && mine?.status === 'found' ? FOUND_CHAT : undefined,
      }}
      playersAside={phone && guessing ? <Others room={room} /> : undefined}
    />
  );
}

export default DailyWordRoom;

function BetweenGames({ room }: { room: Room }) {
  const { state, startGame, starting } = room;
  const count = Object.keys(state.playerList).length;
  const summary = state.lastGame;

  if (summary && !summary.endedEarly) {
    return (
      <>
        <ResultsPanel
          summary={summary}
          detail={`${plural(summary.rounds, 'word')}.`}
          standingDetail={(id) =>
            `${plural(summary.found[id] ?? 0, 'word')} found`
          }
          onPlayAgain={startGame}
          starting={starting}
        />
        <RoundResults state={state} />
      </>
    );
  }
  if (summary?.endedEarly && count < 2) return <EndedEarlyPanel />;
  return (
    <WaitingPanel
      aloneTitle="A little better with company."
      setup={`${plural(count, 'player')}, ${plural(state.rounds, 'word')}. Everyone guesses the same hidden word at once, and fewer guesses score more.`}
      guestSetup={`${plural(count, 'player')}, ${plural(state.rounds, 'word')}.`}
      onStart={startGame}
      starting={starting}
    />
  );
}

/** DW07-DW09, DW13: one word: the turn bar, then your board or the reveal. */
function Round({ room }: { room: Room }) {
  const { state, receivedAt, reconnecting, socket, playerId } = room;
  const seconds = useSecondsLeft(state.phaseEndsInMs, receivedAt, reconnecting);
  const phone = useMediaQuery(PHONE);
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const mine = state.boards.find((board) => board.playerId === playerId);

  if (state.phase === 'reveal' || !mine) {
    return (
      <>
        <TurnBar {...turnBar(room, seconds, mine)} />
        <RoundResults state={state} />
      </>
    );
  }

  const rows = mine.rows.map((row) => ({
    word: row.word ?? '',
    marks: row.marks,
  }));
  const done = mine.status !== 'guessing';
  const change = (next: string) => {
    setTyped(next);
    setProblem(null);
  };
  const typing = {
    onLetter: (letter: string) => {
      if (typed.length < 5) change(typed + letter);
    },
    onDelete: () => change(typed.slice(0, -1)),
    onEnter: async () => {
      if (sending) return;
      // The lists are here too, so most refusals need no round trip; the
      // server checks again and marks the guess.
      const local = checkGuess(
        typed,
        rows.map((row) => row.word),
      );
      if (local) {
        setProblem(GUESS_PROBLEM_TEXT[local]);
        return;
      }
      setSending(true);
      try {
        const answer = await socket
          .timeout(REQUEST_TIMEOUT_MS)
          .emitWithAck('dw:guess', state.roomId, typed);
        if (answer.ok) setTyped('');
        else setProblem(answer.error.message);
      } catch {
        setProblem('That guess did not reach the room. Try again.');
      }
      setSending(false);
    },
  };

  return (
    <>
      <TurnBar {...turnBar(room, seconds, mine)} />
      <BoardPanel>
        <div className={styles.table}>
          <PlayArea
            rows={rows}
            typed={done ? '' : typed}
            problem={done ? null : problem}
            prompt={
              done
                ? mine.status === 'found'
                  ? 'You found it. Watch the others until the reveal.'
                  : 'Out of guesses. Watch the others until the reveal.'
                : undefined
            }
            typing={typing}
            keyboard={!done}
            disabled={reconnecting || sending}
            className={styles.mine}
          />
          {!phone && <Others room={room} />}
        </div>
      </BoardPanel>
    </>
  );
}

/** DW07, DW08, DW14: everybody else's board, marks only. */
function Others({ room }: { room: Room }) {
  const { state, playerId } = room;
  const others = state.boards.filter((board) => board.playerId !== playerId);
  if (others.length === 0) return null;
  return (
    <section className={styles.others} aria-labelledby="the-others">
      <div className={styles.heading}>
        <h2 id="the-others" className={styles.title}>
          The others
        </h2>
        <p className={styles.note}>Their marks, never their letters</p>
      </div>
      <div className={styles.boards}>
        {others.map((board) => (
          <RaceBoard
            key={board.playerId}
            name={board.username}
            status={raceStatus(board)}
            state={board.status}
            rows={board.rows}
          />
        ))}
      </div>
    </section>
  );
}

const raceStatus = (board: DailyWordBoard): string =>
  board.status === 'found'
    ? `Found · +${board.points}`
    : board.status === 'out'
      ? 'Out of guesses'
      : board.rows.length === 0
        ? 'No guesses yet'
        : plural(board.rows.length, 'guess', 'guesses');

/** DW09, DW10: a finished word's boards, with their letters, best first. */
function RoundResults({ state }: { state: DailyWordRoomState }) {
  const result = state.lastRound;
  if (!result) return null;
  const round = state.isGameStarted
    ? state.round
    : (state.lastGame?.rounds ?? state.round);
  return (
    <BoardPanel>
      <section className={styles.results} aria-labelledby="word-results">
        <div className={styles.heading}>
          <h2 id="word-results" className={styles.title}>
            Word {round} results
          </h2>
          {!state.isGameStarted && (
            <p className={styles.body}>
              The word was {result.word.toUpperCase()}.
            </p>
          )}
        </div>
        <div className={styles.boards}>
          {result.boards.map((board) => (
            <RaceBoard
              key={board.playerId}
              name={board.username}
              status={
                board.status === 'found'
                  ? `Found in ${board.rows.length} · +${board.points}`
                  : 'Missed'
              }
              state={board.status === 'found' ? 'found' : 'out'}
              board="small"
              rows={board.rows}
            />
          ))}
        </div>
      </section>
    </BoardPanel>
  );
}

function turnBar(
  room: Room,
  seconds: number,
  mine: DailyWordBoard | undefined,
): TurnBarProps {
  const { state, playerId, reconnecting } = room;
  const clock = (label: string, waiting = false) =>
    reconnecting
      ? { seconds, label: 'paused', waiting: true }
      : { seconds, label, waiting };
  const label = `Word ${state.round} of ${state.rounds}`;

  if (state.phase === 'reveal') {
    const result = state.lastRound;
    const me = result?.boards.find((board) => board.playerId === playerId);
    return {
      label: 'The word was',
      kind: 'status',
      main: result ? result.word.toUpperCase() : '',
      meta:
        me?.status === 'found'
          ? `You found it in ${me.rows.length} for +${me.points}`
          : 'You did not find it this time',
      countdown: clock(
        state.round < state.rounds ? 'next word' : 'final scores',
        true,
      ),
    };
  }

  const waitingFor = state.boards
    .filter(
      (board) =>
        board.playerId !== playerId &&
        board.status === 'guessing' &&
        state.playerList[board.playerId]?.isConnected,
    )
    .map((board) => board.username);
  if (mine?.status === 'found') {
    return {
      label,
      kind: 'status',
      main: `Got it in ${mine.rows.length}! +${mine.points}`,
      meta: waitingFor.length
        ? `Waiting for ${listNames(waitingFor)}`
        : 'Everyone is done',
      countdown: clock('to guess'),
    };
  }
  if (mine?.status === 'out') {
    return {
      label,
      kind: 'status',
      main: 'Out of guesses',
      meta: waitingFor.length
        ? `Waiting for ${listNames(waitingFor)}`
        : 'Everyone is done',
      countdown: clock('to guess'),
    };
  }
  const finders = state.boards
    .filter((board) => board.status === 'found')
    .map((board) => board.username);
  return {
    label,
    kind: 'status',
    main:
      !mine || mine.rows.length === 0
        ? 'Find the word'
        : `Guess ${mine.rows.length + 1} of ${MAX_GUESSES}`,
    meta: finders.length
      ? `${listNames(finders)} found it`
      : 'Fewer guesses score more',
    countdown: clock('to guess'),
  };
}

/** One player's line on the scoreboard. */
function playerLine(state: DailyWordRoomState, seat: Seat): PlayerLine {
  if (!seat.isConnected) {
    return { seat, status: 'Away', statusIcon: 'away', state: 'away' };
  }
  if (!state.isGameStarted) return { seat, status: 'Waiting' };
  if (state.phase === 'reveal') {
    const board = state.lastRound?.boards.find(
      (b) => b.playerId === seat.playerId,
    );
    if (!board) return { seat, status: 'Waiting' };
    return board.status === 'found'
      ? { seat, status: `Found it · +${board.points}`, statusIcon: 'check' }
      : { seat, status: 'Missed' };
  }
  const board = state.boards.find((b) => b.playerId === seat.playerId);
  if (board?.status === 'found') {
    return {
      seat,
      status: `Found it · +${board.points}`,
      statusIcon: 'check',
      state: 'scored',
    };
  }
  if (board?.status === 'out') return { seat, status: 'Out of guesses' };
  return { seat, status: 'Guessing' };
}
