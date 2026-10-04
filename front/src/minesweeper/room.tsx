import type {
  MinesweeperPickResult,
  MinesweeperRoomState,
} from '../../../shared/wire-types';
import { PickResult, TurnBar, type TurnBarProps } from '../ui';
import { plural } from '../games/plural';
import { useSecondsLeft } from '../net/use-seconds-left';
import { initialsOf, toneOf } from '../players/avatar';
import { EndedEarlyPanel, ResultsPanel, WaitingPanel } from '../room/panels';
import { listNames, rankedPlayers, type Seat } from '../room/players';
import { useRoomContext, type Room as RoomOf } from '../room/room-context';
import { RoomLayout, type PlayerLine } from '../room/room-layout';
import { PHONE, useMediaQuery } from '../shell/use-media-query';
import { BOARD_SIZES } from '../../../shared/minesweeper';
import { Board } from './board';
import styles from './room.module.css';

type Room = RoomOf<MinesweeperRoomState>;

/** M01-M16: a Minesweeper room, before, during and after a game. */
export function MinesweeperRoom() {
  const room = useRoomContext<MinesweeperRoomState>();
  const { state } = room;
  const players = rankedPlayers(state);
  const inGame = state.isGameStarted;
  const ended = !inGame ? state.lastGame : null;
  return (
    <RoomLayout
      phase={
        inGame
          ? { tone: 'blue', label: `Round ${state.round}` }
          : ended && !ended.endedEarly
            ? { tone: 'lime', label: 'Game over' }
            : ended && players.length < 2
              ? { tone: 'peach', label: 'Game ended' }
              : { tone: 'blue', label: 'Waiting room' }
      }
      stage={inGame ? <Round room={room} /> : <BetweenGames room={room} />}
      players={players.map((seat) => playerLine(state, seat))}
      chat={{ placeholder: 'Say something…' }}
    />
  );
}

function BetweenGames({ room }: { room: Room }) {
  const { state, startGame, starting } = room;
  const count = Object.keys(state.playerList).length;
  const summary = state.lastGame;
  const { width, height, mines } = BOARD_SIZES[state.difficulty];

  if (summary && !summary.endedEarly) {
    return (
      <>
        <ResultsPanel
          summary={summary}
          detail={`${summary.difficulty} board, ${plural(summary.rounds, 'round')}.`}
          onPlayAgain={startGame}
          starting={starting}
        />
        <Minefield room={room} showPicks={false} />
      </>
    );
  }
  if (summary?.endedEarly && count < 2) return <EndedEarlyPanel />;
  return (
    <WaitingPanel
      aloneTitle="A little better with company."
      setup={`${plural(count, 'player')} on a ${state.difficulty} board: ${width} × ${height} with ${mines} mines. Every round, everyone picks one cell at the same time.`}
      guestSetup={`${plural(count, 'player')} on a ${state.difficulty} board.`}
      onStart={startGame}
      starting={starting}
    />
  );
}

/** M04-M13: one round: the turn bar, then the board and the last results. */
function Round({ room }: { room: Room }) {
  const { state, receivedAt, reconnecting, socket } = room;
  const seconds = useSecondsLeft(state.phaseEndsInMs, receivedAt, reconnecting);
  const canPick =
    state.phase === 'picking' && state.myPick === null && !reconnecting;
  const phone = useMediaQuery(PHONE);

  return (
    <>
      <TurnBar {...turnBar(room, seconds, phone)} />
      <Minefield
        room={room}
        showPicks={state.phase === 'reveal'}
        onPick={
          canPick
            ? (index) => socket.emit('ms:pick', state.roomId, index)
            : undefined
        }
      />
    </>
  );
}

/**
 * The board, with the latest round's results under it. A phone shows them
 * only while the round is revealed (MO13), so the next pick (MO11, MO12)
 * keeps the board alone on screen.
 */
function Minefield({
  room,
  showPicks,
  onPick,
}: {
  room: Room;
  showPicks: boolean;
  onPick?: (index: number) => void;
}) {
  const { state } = room;
  const phone = useMediaQuery(PHONE);
  const results =
    phone && state.isGameStarted && state.phase === 'picking'
      ? []
      : state.lastRound.toSorted((a, b) => b.points - a.points);
  // The round the results belong to: the one being revealed, the one before
  // the open one, or the last round of a finished game.
  const resultsRound = !state.isGameStarted
    ? (state.lastGame?.rounds ?? state.round)
    : state.phase === 'reveal'
      ? state.round
      : state.round - 1;

  return (
    <div className={styles.minefield}>
      <div className={styles.boardPanel}>
        <Board state={state} onPick={onPick} showPicks={showPicks} />
      </div>
      {results.length > 0 && (
        <section className={styles.results} aria-labelledby="round-results">
          <h2 id="round-results" className={styles.resultsTitle}>
            Round {resultsRound} results
          </h2>
          <ul className={styles.resultList}>
            {results.map((pick) => (
              <PickResult
                key={pick.playerId}
                name={pick.username}
                initials={initialsOf(pick.username)}
                tone={toneOf(pick.username)}
                outcome={outcomeOf(pick)}
                detail={pickDetail(pick)}
                points={pick.points}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function outcomeOf(pick: MinesweeperPickResult) {
  if (pick.hitMine) return 'mine' as const;
  return pick.autoPlayed ? ('auto' as const) : ('safe' as const);
}

const percent = (risk: number) => `${Math.round(risk * 100)}%`;

/** "23% risk", "0% risk · split 2 ways". */
function pickDetail(pick: MinesweeperPickResult): string {
  const risk = `${percent(pick.risk)} risk`;
  return pick.sharedWith > 1 ? `${risk} · split ${pick.sharedWith} ways` : risk;
}

/** Signed with a true minus: "+31", "−105". */
const signed = (points: number) =>
  points > 0 ? `+${points}` : points < 0 ? `−${-points}` : '+0';

/** "Ryan", "Ryan and Maya", "Ryan, Leo and Maya". */
function turnBar(room: Room, seconds: number, phone: boolean): TurnBarProps {
  const { state, playerId, reconnecting } = room;
  const category = `${state.difficulty} · ${state.width} × ${state.height}`;
  const clock = (label: string, waiting = false) =>
    reconnecting
      ? { seconds, label: 'paused', waiting: true }
      : { seconds, label, waiting };

  if (state.phase === 'reveal') {
    const mine = state.lastRound.find((pick) => pick.playerId === playerId);
    const base = {
      category,
      label: `Round ${state.round} results`,
      kind: 'status' as const,
      countdown: clock('next round', true),
    };
    if (!mine) return { ...base, main: 'Round over' };
    if (mine.autoPlayed) {
      return {
        ...base,
        main: 'Time ran out',
        meta: `The safest cell was picked for you: ${percent(mine.risk)} risk, so ${signed(mine.points)}`,
      };
    }
    if (mine.hitMine) {
      return {
        ...base,
        main: `Mine. ${signed(mine.points)}`,
        // MO13: a phone shows the risk alone.
        meta: phone
          ? `Your cell had a ${percent(mine.risk)} risk`
          : `Your cell had a ${percent(mine.risk)} risk. A mine costs more the safer it looked.`,
      };
    }
    const sharers = state.lastRound
      .filter((pick) => pick.index === mine.index && pick.playerId !== playerId)
      .map((pick) => pick.username);
    return {
      ...base,
      main: `Safe! ${signed(mine.points)}`,
      meta: sharers.length
        ? `${listNames(['You', ...sharers])} picked the same cell, so you split its reward`
        : `Your cell had a ${percent(mine.risk)} risk`,
    };
  }

  const label = `Round ${state.round}`;
  const connected = Object.entries(state.playerList).filter(
    ([, player]) => player.isConnected,
  );
  const everyoneIn = connected.every(([id]) => state.lockedIn.includes(id));

  if (everyoneIn) {
    return {
      category,
      label,
      kind: 'status',
      main: 'Everyone is locked in',
      meta: 'Revealing the picks…',
    };
  }
  if (state.myPick !== null) {
    const waitingFor = connected
      .filter(([id]) => !state.lockedIn.includes(id))
      .map(([, player]) => player.username);
    return {
      category,
      label,
      kind: 'status',
      main: 'Locked in',
      meta: `Waiting for ${listNames(waitingFor)}`,
      countdown: clock('to pick'),
    };
  }
  return {
    category,
    label,
    kind: 'status',
    main: 'Pick a cell',
    meta:
      state.minesFound > 0
        ? `${state.totalMines} mines · ${state.minesFound} hit so far`
        : `${state.totalMines} mines · your pick locks when you click`,
    countdown: clock('to pick'),
  };
}

/** One player's line on the scoreboard. */
function playerLine(state: MinesweeperRoomState, seat: Seat): PlayerLine {
  if (!seat.isConnected) {
    return { seat, status: 'Away', statusIcon: 'away', state: 'away' };
  }
  if (!state.isGameStarted) return { seat, status: 'Waiting' };
  if (state.phase === 'reveal') {
    const pick = state.lastRound.find((p) => p.playerId === seat.playerId);
    if (!pick) return { seat, status: 'Waiting' };
    if (pick.hitMine) {
      return {
        seat,
        status: `Hit a mine · ${signed(pick.points)}`,
        statusIcon: 'mine',
      };
    }
    if (pick.autoPlayed) {
      return {
        seat,
        status: `Auto-picked · ${signed(pick.points)}`,
        statusIcon: 'clock',
      };
    }
    return {
      seat,
      status: `Safe · ${signed(pick.points)}`,
      statusIcon: 'check',
      state: 'scored',
    };
  }
  return state.lockedIn.includes(seat.playerId)
    ? { seat, status: 'Locked in', statusIcon: 'lock' }
    : { seat, status: 'Picking' };
}
