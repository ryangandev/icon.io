import { bidWords } from '../../../shared/liars-dice';
import type { LiarsDiceRoomState } from '../../../shared/wire-types';
import { BidPicker, Button, TurnBar, type TurnBarProps } from '../ui';
import { plural } from '../i18n/en/plural';
import { useSecondsLeft } from '../net/use-seconds-left';
import { EndedEarlyPanel, ResultsPanel, WaitingPanel } from '../room/panels';
import { rankedPlayers, type Seat } from '../room/players';
import { useRoomContext, type Room as RoomOf } from '../room/room-context';
import { RoomLayout, type PlayerLine } from '../room/room-layout';
import { useBidChoice } from './bid-choice';
import { Table, type TableSeat } from './table';
import {
  bidLine,
  diceWord,
  naming,
  revealBar,
  stood,
  type Naming,
} from './words';
import styles from './room.module.css';

type Room = RoomOf<LiarsDiceRoomState>;

/** LD08-LD12: a Liar's Dice room, before, during and after a game. */
export function LiarsDiceRoom() {
  const room = useRoomContext<LiarsDiceRoomState>();
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
      stage={inGame ? <Turn room={room} /> : <BetweenGames room={room} />}
      players={players.map((seat) => playerLine(state, seat))}
      chat={{ placeholder: 'Say something…' }}
    />
  );
}

const whoIn = (room: Room): Naming =>
  naming(
    room.playerId,
    (id) => room.state.playerList[id]?.username ?? 'Somebody',
  );

/** The cups as the table draws them: seated players, in turn order. */
const seatsOf = (state: LiarsDiceRoomState): TableSeat[] =>
  state.cups.map((cup) => ({
    id: cup.playerId,
    name: state.playerList[cup.playerId]?.username ?? 'Somebody',
    diceLeft: cup.diceLeft,
    dice: cup.dice,
    outInRound: cup.outInRound,
  }));

const diceOnTable = (state: LiarsDiceRoomState) =>
  state.cups.reduce((total, cup) => total + cup.diceLeft, 0);

function BetweenGames({ room }: { room: Room }) {
  const { state, startGame, starting } = room;
  const count = Object.keys(state.playerList).length;
  const summary = state.lastGame;
  const each = `${diceWord(state.dicePerPlayer)} each`;

  if (summary && !summary.endedEarly) {
    return (
      <>
        <ResultsPanel
          summary={summary}
          detail={`${plural(summary.rounds, 'round')}, ${diceWord(summary.dicePerPlayer)} each.`}
          onPlayAgain={startGame}
          starting={starting}
          ranked
          statusOf={(standing, place) =>
            place === 1
              ? 'Winner'
              : standing.outInRound === null
                ? 'Left the game'
                : `Out in round ${standing.outInRound}`
          }
        />
        {/* LD12: the last call stays open under the results. */}
        {state.reveal && (
          <Table
            seats={seatsOf(state)}
            youId={room.playerId}
            dicePerPlayer={state.dicePerPlayer}
            turnId={null}
            nextId={null}
            bids={[]}
            reveal={state.reveal}
            who={whoIn(room)}
            countLabel="The last call"
          />
        )}
      </>
    );
  }
  if (summary?.endedEarly && count < 2) return <EndedEarlyPanel />;
  return (
    <WaitingPanel
      aloneTitle="A little better with company."
      setup={`${plural(count, 'player')}, ${each}. Everybody rolls in secret, then bids on the whole table; call Liar on a bid you doubt.`}
      guestSetup={`${plural(count, 'player')}, ${each}.`}
      onStart={startGame}
      starting={starting}
    />
  );
}

/** LD08-LD11: whose turn it is, and the table. */
function Turn({ room }: { room: Room }) {
  const { state, receivedAt, reconnecting, playerId } = room;
  const seconds = useSecondsLeft(state.phaseEndsInMs, receivedAt, reconnecting);
  const mine =
    state.phase === 'bidding' &&
    state.turnPlayerId === playerId &&
    !reconnecting;
  const out = (state.playerList[playerId]?.points ?? 0) === 0;
  return (
    <>
      <TurnBar {...turnBar(room, seconds)} />
      <Table
        seats={seatsOf(state)}
        youId={playerId}
        dicePerPlayer={state.dicePerPlayer}
        turnId={state.turnPlayerId}
        nextId={state.nextPlayerId}
        bids={state.bids}
        reveal={state.phase === 'reveal' ? state.reveal : null}
        who={whoIn(room)}
        beside={
          mine ? (
            <YourMove room={room} />
          ) : out ? (
            <p className={styles.note}>
              You are out of dice. Stay to watch who wins, and keep the table
              talk going.
            </p>
          ) : undefined
        }
      />
    </>
  );
}

/** LD09: the bid picker, opening on the smallest raise. */
function YourMove({ room }: { room: Room }) {
  const { state, socket } = room;
  const latest = state.bids.at(-1) ?? null;
  const picker = useBidChoice(latest, diceOnTable(state), (bid) =>
    socket.emit('ld:bid', state.roomId, bid.count, bid.face),
  );
  const call = latest ? () => socket.emit('ld:call', state.roomId) : undefined;
  // Every die on the table bid as 6s leaves nothing to raise to.
  if (!picker) {
    return (
      <div className={styles.callOnly}>
        <Button variant="danger" onClick={call}>
          Call Liar
        </Button>
      </div>
    );
  }
  return <BidPicker {...picker} onCall={call} />;
}

function turnBar(room: Room, seconds: number): TurnBarProps {
  const { state, playerId, reconnecting } = room;
  const who = whoIn(room);
  const clock = (label: string, waiting: boolean) =>
    reconnecting
      ? { seconds, label: 'paused', waiting: true }
      : { seconds, label, waiting };

  if (state.phase === 'reveal' && state.reveal) {
    return {
      ...revealBar(state.reveal, who),
      kind: 'status',
      countdown: clock('next round', true),
    };
  }
  const latest = state.bids.at(-1);
  const name = who(state.turnPlayerId ?? '').name;
  const bidMeta = latest ? bidLine(who(latest.playerId), latest) : undefined;
  if (state.turnPlayerId === playerId) {
    return {
      label: 'Your turn',
      kind: 'status',
      main: latest ? 'Raise, or call Liar' : 'Open the bidding',
      meta: bidMeta ?? `${diceWord(diceOnTable(state))} on the table`,
      countdown: clock('to bid', false),
    };
  }
  return {
    label: `${name}’s turn`,
    kind: 'status',
    main: `${name} is deciding`,
    meta: bidMeta ?? 'Opening the round',
    countdown: clock('to bid', true),
  };
}

/** One player's line on the scoreboard; their score is their dice left. */
function playerLine(state: LiarsDiceRoomState, seat: Seat): PlayerLine {
  if (!seat.isConnected) {
    return { seat, status: 'Away', statusIcon: 'away', state: 'away' };
  }
  if (!state.isGameStarted) return { seat, status: 'Waiting' };
  const { reveal } = state;
  if (state.phase === 'reveal' && reveal) {
    if (seat.playerId === reveal.loserId) {
      return { seat, status: reveal.out ? 'Out' : 'Lost a die' };
    }
    if (seat.playerId === reveal.bid.playerId) {
      return { seat, status: stood(reveal) ? 'Bid stands' : 'Bid was a lie' };
    }
    if (seat.playerId === reveal.callerId) {
      return { seat, status: 'Called Liar' };
    }
  }
  if (seat.points === 0) return { seat, status: 'Out' };
  if (state.phase === 'bidding') {
    if (seat.playerId === state.turnPlayerId) {
      return { seat, status: 'Bidding', state: 'highlight' };
    }
    if (seat.playerId === state.nextPlayerId) {
      return { seat, status: 'Up next' };
    }
    const own = state.bids.findLast((bid) => bid.playerId === seat.playerId);
    if (own) return { seat, status: `Bid ${bidWords(own)}` };
  }
  return { seat, status: 'Waiting' };
}
