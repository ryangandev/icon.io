import { useState } from 'react';
import type { TriosRoomState } from '../../../shared/wire-types';
import type { TurnBarProps } from '../ui';
import { plural } from '../games/plural';
import { useSecondsLeft } from '../net/use-seconds-left';
import { useSecondsSince } from '../net/use-seconds-since';
import { initialsOf } from '../players/avatar';
import { EndedEarlyPanel, ResultsPanel, WaitingPanel } from '../room/panels';
import { rankedPlayers, type Seat } from '../room/players';
import { useRoomContext, type Room as RoomOf } from '../room/room-context';
import { RoomLayout, type PlayerLine } from '../room/room-layout';
import {
  LastTrio,
  TablePanel,
  TriosTable,
  TriosTurnBar,
  type PlaceView,
} from './table';
import { whyNotATrio } from './words';

type Room = RoomOf<TriosRoomState>;

/** TS05-TS09, TS12: a Trios room, before, during and after a game. */
export function TriosRoom() {
  const room = useRoomContext<TriosRoomState>();
  const { state } = room;
  const players = rankedPlayers(state);
  const inGame = state.isGameStarted;
  const ended = !inGame ? state.lastGame : null;
  return (
    <RoomLayout
      phase={
        inGame
          ? {
              tone: 'blue',
              label: `${state.found} of ${plural(state.trios, 'trio')}`,
            }
          : ended && !ended.endedEarly
            ? { tone: 'lime', label: 'Game over' }
            : ended && players.length < 2
              ? { tone: 'peach', label: 'Game ended' }
              : { tone: 'blue', label: 'Waiting room' }
      }
      stage={inGame ? <Play room={room} /> : <BetweenGames room={room} />}
      players={players.map((seat) => playerLine(state, seat))}
      chat={{ placeholder: 'Say something…' }}
    />
  );
}

/** Who took the latest trio, as the card badges and the strip name them. */
function finderOf(state: TriosRoomState, playerId: string) {
  const trio = state.lastTrio;
  if (!trio) return null;
  return {
    initials: initialsOf(trio.username),
    name: trio.playerId === playerId ? 'you' : trio.username,
    label: `by ${trio.playerId === playerId ? 'you' : trio.username}`,
  };
}

/** The places of a trio just taken, marked with who took it. */
function takenPlaces(
  state: TriosRoomState,
  playerId: string,
): Record<number, PlaceView> {
  const finder = finderOf(state, playerId);
  if (!state.lastTrio || !finder) return {};
  return Object.fromEntries(
    state.lastTrio.places.map((place) => [
      place,
      { state: 'found', badge: finder.initials, badgeLabel: finder.label },
    ]),
  );
}

function BetweenGames({ room }: { room: Room }) {
  const { state, startGame, starting, playerId } = room;
  const count = Object.keys(state.playerList).length;
  const summary = state.lastGame;

  if (summary && !summary.endedEarly) {
    const finder = finderOf(state, playerId);
    return (
      <>
        <ResultsPanel
          summary={summary}
          detail={`${plural(summary.trios, 'trio')}.`}
          onPlayAgain={startGame}
          starting={starting}
        />
        {/* TS09: the finished table stays until the next game is dealt. */}
        <TablePanel>
          <TriosTable
            cards={state.table}
            places={takenPlaces(state, playerId)}
          />
          {state.lastTrio && finder && (
            <LastTrio finder={finder.name} cards={state.lastTrio.cards} />
          )}
        </TablePanel>
      </>
    );
  }
  if (summary?.endedEarly && count < 2) return <EndedEarlyPanel />;
  return (
    <WaitingPanel
      aloneTitle="A little better with company."
      setup={`${plural(count, 'player')}, ${plural(state.trios, 'trio')}. Everybody looks at the same twelve cards; the first to pick a trio takes it.`}
      guestSetup={`${plural(count, 'player')}, ${plural(state.trios, 'trio')}.`}
      onStart={startGame}
      starting={starting}
    />
  );
}

/** TS05-TS08, TS12: the table everybody looks at, and your own picks. */
function Play({ room }: { room: Room }) {
  const { state, receivedAt, reconnecting, socket, playerId } = room;
  const seconds = useSecondsLeft(state.phaseEndsInMs, receivedAt, reconnecting);
  const lockedSeconds = useSecondsLeft(
    state.lockedOutMs,
    receivedAt,
    reconnecting,
  );
  // Once both hints are given there is nothing left to count down to.
  const searchingSeconds = useSecondsSince(
    state.searchingMs,
    receivedAt,
    reconnecting || state.hint.length < 2,
  );
  // Picks are yours alone and never leave this page until the third. A card
  // somebody else took leaves them; the rest stay picked.
  const [picks, setPicks] = useState<readonly number[]>([]);
  const picked = picks.filter((card) => state.table.includes(card));
  const locked = state.lockedOutMs > 0;
  const canPick = state.phase === 'finding' && !locked && !reconnecting;

  const pick = (place: number) => {
    const card = state.table[place];
    if (picked.includes(card)) {
      setPicks(picked.filter((other) => other !== card));
      return;
    }
    const next = [...picked, card];
    if (next.length < 3) {
      setPicks(next);
      return;
    }
    setPicks([]);
    socket.emit('trios:claim', state.roomId, next);
  };

  const places: Record<number, PlaceView> = {};
  for (const place of state.hint) {
    places[place] = { badge: 'Hint', badgeLabel: 'hint' };
  }
  // Your picks stay shown while a trio is taken, so you see what is still picked.
  for (const card of picked) {
    const place = state.table.indexOf(card);
    places[place] = { ...places[place], state: 'selected' };
  }
  if (locked) {
    for (const card of state.myMiss) {
      const place = state.table.indexOf(card);
      if (place >= 0) places[place] = { ...places[place], state: 'wrong' };
    }
  }
  if (state.phase === 'taken')
    Object.assign(places, takenPlaces(state, playerId));

  const finder = finderOf(state, playerId);
  return (
    <>
      {/* The longest of its lines, why three cards are not a trio, takes two. */}
      <TriosTurnBar
        lines={2}
        {...turnBar(room, picked.length, {
          seconds,
          lockedSeconds,
          searchingSeconds,
        })}
      />
      <TablePanel>
        <TriosTable
          cards={state.table}
          places={places}
          onPick={canPick ? pick : undefined}
        />
        {state.lastTrio && finder && (
          <LastTrio finder={finder.name} cards={state.lastTrio.cards} />
        )}
      </TablePanel>
    </>
  );
}

/** The clocks the turn bar can show, in whole seconds. */
interface Clocks {
  /** Left of the phase: to the next hint, or to new cards. */
  seconds: number;
  /** Left of this player's lockout. */
  lockedSeconds: number;
  /** How long the table has gone without a trio. */
  searchingSeconds: number;
}

/**
 * What the turn bar says, with a clock in every phase: the bar keeps its
 * height, so the table under it never moves.
 */
function turnBar(
  room: Room,
  picked: number,
  { seconds, lockedSeconds, searchingSeconds }: Clocks,
): TurnBarProps {
  const { state, playerId, reconnecting } = room;
  // While reconnecting the server's clocks cannot be known: they hold.
  const clock = (label: string, waiting: boolean, left = seconds) =>
    reconnecting
      ? { seconds: left, label: 'paused', waiting: true }
      : { seconds: left, label, waiting };
  // A hint is help, not a deadline, and neither is the time since a trio:
  // those clocks never turn urgent.
  const helpClock = (label: string, left = seconds) => ({
    ...clock(label, false, left),
    deadline: false,
  });
  if (state.phase === 'taken' && state.lastTrio) {
    const mine = state.lastTrio.playerId === playerId;
    return {
      label: 'Trio taken',
      kind: 'status',
      main: mine
        ? 'You found a trio!'
        : `${state.lastTrio.username} found a trio`,
      meta: 'New cards in a moment',
      countdown: clock('new cards', true),
    };
  }
  if (state.lockedOutMs > 0) {
    return {
      label: 'Not a trio',
      kind: 'status',
      main: whyNotATrio(state.myMiss) ?? 'Not a trio',
      meta: 'You can pick again in a moment',
      countdown: clock('locked out', false, lockedSeconds),
    };
  }
  const hints = state.hint.length;
  return {
    label: hints > 0 ? 'Hint' : 'Find a trio',
    kind: 'status',
    main:
      picked === 2
        ? 'Pick a third card'
        : picked === 1
          ? 'Pick two more'
          : hints === 1
            ? 'One card of a trio is marked'
            : hints === 2
              ? 'Two cards of a trio are marked'
              : 'Pick three cards',
    meta:
      hints === 1
        ? 'Find the two that go with it'
        : hints === 2
          ? 'Find the third card'
          : 'The first trio claimed takes it',
    // After the second hint nothing is left to count down to, so the clock
    // counts the time the table has gone without a trio.
    countdown:
      hints < 2
        ? helpClock(hints === 0 ? 'to a hint' : 'to a second hint')
        : helpClock('without a trio', searchingSeconds),
  };
}

/** One player's line on the scoreboard. */
function playerLine(state: TriosRoomState, seat: Seat): PlayerLine {
  if (!seat.isConnected) {
    return { seat, status: 'Away', statusIcon: 'away', state: 'away' };
  }
  if (!state.isGameStarted) return { seat, status: 'Waiting' };
  if (state.phase === 'taken' && state.lastTrio?.playerId === seat.playerId) {
    return { seat, status: 'Found a trio', state: 'scored' };
  }
  return { seat, status: 'Looking' };
}
