import type { PairsCardView, PairsRoomState } from '../../../shared/wire-types';
import { PAIRS_BOARDS } from '../../../shared/pairs';
import { TurnBar, type PairsCardState, type TurnBarProps } from '../ui';
import { plural } from '../i18n/en/plural';
import { useSecondsLeft } from '../net/use-seconds-left';
import { EndedEarlyPanel, ResultsPanel, WaitingPanel } from '../room/panels';
import { rankedPlayers, type Seat } from '../room/players';
import { useRoomContext, type Room as RoomOf } from '../room/room-context';
import { RoomLayout, type PlayerLine } from '../room/room-layout';
import { PHONE, useMediaQuery } from '../shell/use-media-query';
import { BoardPanel, PairsGrid } from './board';
import { boardName } from './boards';

type Room = RoomOf<PairsRoomState>;

/** PR05-PR07, PR10: a Pairs room, before, during and after a game. */
export function PairsRoom() {
  const room = useRoomContext<PairsRoomState>();
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
              label: `${state.pairsFound} of ${plural(PAIRS_BOARDS[state.board].pairs, 'pair')}`,
            }
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

const cardsOf = (cards: readonly PairsCardView[]): PairsCardState[] =>
  cards.map((card) =>
    card.symbol === null || card.state === 'down'
      ? { kind: 'down' }
      : { kind: card.state, symbol: card.symbol },
  );

function BetweenGames({ room }: { room: Room }) {
  const { state, startGame, starting } = room;
  const count = Object.keys(state.playerList).length;
  const summary = state.lastGame;

  if (summary && !summary.endedEarly) {
    return (
      <>
        <ResultsPanel
          summary={summary}
          detail={`${summary.board} board, ${plural(summary.pairs, 'pair')}.`}
          onPlayAgain={startGame}
          starting={starting}
        />
        {/* PR07: the finished board stays on the table. */}
        <BoardPanel>
          <PairsGrid cards={cardsOf(state.cards)} />
        </BoardPanel>
      </>
    );
  }
  if (summary?.endedEarly && count < 2) return <EndedEarlyPanel />;
  return (
    <WaitingPanel
      aloneTitle="A little better with company."
      setup={`${plural(count, 'player')}, ${boardName(state.board)}. Take turns flipping two cards; find a pair and you go again.`}
      guestSetup={`${plural(count, 'player')}, ${boardName(state.board)}.`}
      onStart={startGame}
      starting={starting}
    />
  );
}

/** PR05, PR06, PR10: whose turn it is, and the board. */
function Turn({ room }: { room: Room }) {
  const { state, receivedAt, reconnecting, socket, playerId } = room;
  const seconds = useSecondsLeft(state.phaseEndsInMs, receivedAt, reconnecting);
  const phone = useMediaQuery(PHONE);
  const flipping =
    state.phase === 'flipping' &&
    state.turnPlayerId === playerId &&
    !reconnecting;
  return (
    <>
      <TurnBar {...turnBar(room, seconds, phone)} />
      <BoardPanel>
        <PairsGrid
          cards={cardsOf(state.cards)}
          onFlip={
            flipping
              ? (index) => socket.emit('pairs:flip', state.roomId, index)
              : undefined
          }
        />
      </BoardPanel>
    </>
  );
}

function turnBar(room: Room, seconds: number, phone: boolean): TurnBarProps {
  const { state, playerId, reconnecting } = room;
  const mine = state.turnPlayerId === playerId;
  const clock = (label: string, waiting: boolean) =>
    reconnecting
      ? { seconds, label: 'paused', waiting: true }
      : { seconds, label, waiting };
  const nameOf = (id: string | null) =>
    id === null ? null : (state.playerList[id]?.username ?? null);
  const label = mine ? 'Your turn' : `${nameOf(state.turnPlayerId)}’s turn`;
  const next = nameOf(state.nextPlayerId);
  const whoIsNext =
    state.nextPlayerId === playerId
      ? 'You’re next.'
      : next
        ? `${next} is next.`
        : '';

  if (state.phase === 'showing') {
    return {
      label,
      kind: 'status',
      main: 'Not a pair',
      meta: `Both flip back. ${whoIsNext}`.trim(),
      countdown: clock('flip back', true),
    };
  }
  if (mine) {
    const oneUp = state.cards.some((card) => card.state === 'up');
    return {
      label,
      kind: 'status',
      main: oneUp ? 'Flip a second card' : 'Flip a card',
      meta: phone ? 'A pair keeps your turn' : 'Find a pair and you go again',
      countdown: clock('to flip', false),
    };
  }
  return {
    label,
    kind: 'status',
    main: 'Watch closely',
    meta: whoIsNext || undefined,
    countdown: clock('to flip', true),
  };
}

/** One player's line on the scoreboard. */
function playerLine(state: PairsRoomState, seat: Seat): PlayerLine {
  if (!seat.isConnected) {
    return { seat, status: 'Away', statusIcon: 'away', state: 'away' };
  }
  if (!state.isGameStarted) return { seat, status: 'Waiting' };
  if (seat.playerId === state.turnPlayerId) {
    return { seat, status: 'Flipping', state: 'highlight' };
  }
  if (seat.playerId === state.nextPlayerId) return { seat, status: 'Up next' };
  return { seat, status: 'Waiting' };
}
