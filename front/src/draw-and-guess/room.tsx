import { useCallback, useEffect, useState } from 'react';
import type {
  Coordinate,
  DrawAndGuessRoomState,
} from '../../../shared/wire-types';
import {
  brushes,
  DrawingToolbar,
  Icon,
  Notice,
  TurnBar,
  WordChoice,
  type BrushName,
  type BrushSize,
  type TurnBarProps,
} from '../ui';
import { plural } from '../games/plural';
import { useSecondsLeft } from '../net/use-seconds-left';
import { PHONE, useMediaQuery } from '../shell/use-media-query';
import { EndedEarlyPanel, ResultsPanel, WaitingPanel } from '../room/panels';
import { rankedPlayers, type Seat } from '../room/players';
import { useRoomContext, type Room as RoomOf } from '../room/room-context';
import { RoomLayout, type PlayerLine } from '../room/room-layout';
import { DrawingCanvas, type Brush } from './canvas';
import styles from './room.module.css';

type Room = RoomOf<DrawAndGuessRoomState>;

/** D01-D15: a Draw & Guess room, before, during and after a game. */
export function DrawAndGuessRoom() {
  const room = useRoomContext<DrawAndGuessRoomState>();
  const { state } = room;
  const players = rankedPlayers(state);
  const count = players.length;
  const inGame = state.isGameStarted;
  const drawing = inGame && state.phase === 'drawing';
  const isDrawer = inGame && state.currentDrawer === room.playerId;
  const scored = state.scoredThisTurn.includes(room.playerId);

  const between = !inGame;
  const ended = between && state.lastGame;

  return (
    <RoomLayout
      phase={
        inGame
          ? {
              tone: 'blue',
              label: `Round ${state.currentRound} of ${state.rounds}`,
            }
          : ended && !ended.endedEarly
            ? { tone: 'lime', label: 'Game over' }
            : ended && count < 2
              ? { tone: 'peach', label: 'Game ended' }
              : { tone: 'blue', label: 'Waiting room' }
      }
      subtitle={
        between && !ended
          ? `${plural(state.rounds, 'round')} · up to ${state.maxPlayers} players`
          : undefined
      }
      notice={<DrawerAway room={room} />}
      stage={inGame ? <Turn room={room} /> : <BetweenGames room={room} />}
      players={players.map((seat) => playerLine(state, seat))}
      chat={{
        placeholder:
          drawing && !isDrawer && !scored
            ? 'Type your guess…'
            : 'Say something…',
        lockedReason:
          isDrawer && state.phase !== 'reveal'
            ? 'You’re drawing. Chat opens after your turn.'
            : scored && state.phase === 'drawing'
              ? 'You got it. Chat opens next turn.'
              : undefined,
      }}
      boardInput={drawing && !isDrawer && !scored}
    />
  );
}

/** D10: the drawer dropped; the turn waits a few seconds for them. */
function DrawerAway({ room }: { room: Room }) {
  const { state, receivedAt } = room;
  const seconds = useSecondsLeft(state.drawerHoldEndsInMs, receivedAt);
  if (!state.isGameStarted || state.drawerHoldEndsInMs <= 0) return null;
  const drawer =
    state.playerList[state.currentDrawer]?.username ?? 'The drawer';
  return (
    <Notice tone="pending">
      {drawer} lost connection. Their turn is skipped if they are not back
      within {plural(Math.max(1, seconds), 'second')}.
    </Notice>
  );
}

function BetweenGames({ room }: { room: Room }) {
  const { state, startGame, starting } = room;
  const count = Object.keys(state.playerList).length;
  const rounds = plural(state.rounds, 'round');
  const summary = state.lastGame;

  if (summary && !summary.endedEarly) {
    return (
      <ResultsPanel
        summary={summary}
        detail={`${plural(summary.rounds, 'round')} of ${summary.wordCategory}, ${plural(summary.turns, 'turn')}.`}
        onPlayAgain={startGame}
        starting={starting}
      />
    );
  }
  if (summary?.endedEarly && count < 2) return <EndedEarlyPanel />;
  return (
    <WaitingPanel
      aloneTitle="A little better with two."
      setup={`${plural(count, 'player')}, ${rounds}. The word category is drawn at random when the game starts.`}
      guestSetup={`${plural(count, 'player')}, ${rounds}.`}
      onStart={startGame}
      starting={starting}
    />
  );
}

/** One player's line on the scoreboard. */
function playerLine(state: DrawAndGuessRoomState, seat: Seat): PlayerLine {
  if (!seat.isConnected) {
    return { seat, status: 'Away', statusIcon: 'away', state: 'away' };
  }
  if (!state.isGameStarted) return { seat, status: 'Waiting' };

  const isDrawer = seat.playerId === state.currentDrawer;
  const gained = state.turnPoints[seat.playerId] ?? 0;
  const scored = state.scoredThisTurn.includes(seat.playerId);

  switch (state.phase) {
    case 'choosing':
      return isDrawer
        ? {
            seat,
            status: 'Choosing a word',
            statusIcon: 'brush',
            state: 'highlight',
          }
        : { seat, status: 'Waiting' };
    case 'drawing':
      if (isDrawer) {
        return {
          seat,
          status: 'Drawing',
          statusIcon: 'brush',
          state: 'highlight',
        };
      }
      return scored
        ? { seat, status: 'Guessed it', statusIcon: 'check', state: 'scored' }
        : { seat, status: 'Guessing' };
    case 'reveal':
      if (isDrawer) {
        return { seat, status: `Drew it · +${gained}`, statusIcon: 'brush' };
      }
      return scored
        ? {
            seat,
            status: `Guessed it · +${gained}`,
            statusIcon: 'check',
            state: 'scored',
          }
        : { seat, status: 'Missed it' };
    default:
      return { seat, status: 'Waiting' };
  }
}

const DEFAULT_COLOUR: BrushName = 'ink';
const DEFAULT_SIZE: BrushSize = 10;

/** D04-D12: the turn bar, then the canvas or the word choices. */
function Turn({ room }: { room: Room }) {
  const { state, receivedAt, reconnecting, playerId, socket, canvas } = room;
  const phone = useMediaQuery(PHONE);
  const seconds = useSecondsLeft(state.phaseEndsInMs, receivedAt, reconnecting);
  const isDrawer = state.currentDrawer === playerId;
  const drawerName =
    state.playerList[state.currentDrawer]?.username ?? 'The drawer';
  const [colour, setColour] = useState<BrushName>(DEFAULT_COLOUR);
  const [size, setSize] = useState<BrushSize>(DEFAULT_SIZE);
  const roomId = state.roomId;

  // Every turn starts on a blank sheet.
  useEffect(() => {
    if (state.phase === 'choosing') canvas.clear();
  }, [state.phase, state.turn, canvas]);

  const canDraw = isDrawer && state.phase === 'drawing' && !reconnecting;
  const brush: Brush | undefined = canDraw
    ? {
        color:
          brushes.find((b) => b.name === colour)?.color ?? brushes[0].color,
        size,
      }
    : undefined;

  const start = useCallback(
    (point: Coordinate, { color, size: width }: Brush) => {
      canvas.start(point, color, width);
      socket.emit('dg:draw:start', roomId, point, color, width);
    },
    [canvas, socket, roomId],
  );
  const move = useCallback(
    (point: Coordinate, { color, size: width }: Brush) => {
      canvas.move(point, color, width);
      socket.emit('dg:draw:move', roomId, point, color, width);
    },
    [canvas, socket, roomId],
  );
  const end = useCallback(() => {
    canvas.end();
    socket.emit('dg:draw:end', roomId);
  }, [canvas, socket, roomId]);

  const choose = (word: string) => socket.emit('dg:select-word', roomId, word);

  const choices =
    isDrawer && state.phase === 'choosing' && state.wordChoices ? (
      <div className={styles.choices}>
        {state.wordChoices.map((word) => (
          <WordChoice key={word} word={word} onChoose={() => choose(word)} />
        ))}
      </div>
    ) : null;

  return (
    <>
      <TurnBar {...turnBar(room, seconds, drawerName)} />
      {canDraw && (
        <DrawingToolbar
          colour={colour}
          onColourChange={setColour}
          size={size}
          onSizeChange={setSize}
          onUndo={() => {
            canvas.undo();
            socket.emit('dg:draw:undo', roomId);
          }}
          onClear={() => {
            canvas.clear();
            socket.emit('dg:draw:clear', roomId);
          }}
        />
      )}
      {choices && phone ? (
        choices
      ) : (
        <DrawingCanvas
          stream={canvas}
          brush={brush}
          onStart={start}
          onMove={move}
          onEnd={end}
          overlay={
            choices ??
            (state.phase === 'choosing' ? (
              <p className={styles.waiting}>
                <Icon glyph="brush" size={32} />
                {drawerName}’s drawing will appear here.
              </p>
            ) : null)
          }
        />
      )}
    </>
  );
}

/** What the turn bar says, for this player, in this phase. */
function turnBar(
  room: Room,
  seconds: number,
  drawerName: string,
): TurnBarProps {
  const { state, playerId, reconnecting } = room;
  const isDrawer = state.currentDrawer === playerId;
  const scored = state.scoredThisTurn.includes(playerId);
  const category = state.wordCategory;
  const letters = state.hint.replaceAll(' ', '').length;
  const clock = (label: string, waiting = false) =>
    reconnecting
      ? { seconds, label: 'paused', waiting: true }
      : { seconds, label, waiting };

  switch (state.phase) {
    case 'choosing':
      return isDrawer
        ? {
            category,
            label: 'Your turn to draw',
            kind: 'status',
            main: 'Pick a word',
            meta: 'Only you can see these',
            countdown: clock('to choose'),
          }
        : {
            category,
            label: 'Next up',
            kind: 'status',
            main: `${drawerName} is choosing a word`,
            meta: 'Get ready to guess',
            countdown: clock('to choose', true),
          };
    case 'drawing':
      if (isDrawer) {
        return {
          category,
          label: state.wordAutoPicked
            ? 'Time ran out, so this one was picked for you'
            : 'Draw this',
          kind: 'word',
          main: state.word ?? '',
          meta: 'Only you can see the word',
          countdown: clock('left'),
        };
      }
      return scored
        ? {
            category,
            label: `You got it! +${state.turnPoints[playerId] ?? 0}`,
            kind: 'hint',
            main: state.hint,
            meta: 'Waiting for the others',
            countdown: clock('left'),
          }
        : {
            category,
            label: 'Guess the word',
            kind: 'hint',
            main: state.hint,
            meta: `${plural(letters, 'letter')} · type your guess in the chat`,
            countdown: clock('left'),
          };
    default:
      return {
        category,
        label: 'The word was',
        kind: 'status',
        main: state.word ?? '',
        meta: turnPointsLine(state),
        countdown: clock('next turn', true),
      };
  }
}

/** "Maya +74 · Sam +112 · Ryan +72": the drawer, then each guesser. */
function turnPointsLine(state: DrawAndGuessRoomState): string {
  const drawer = state.currentDrawer;
  const scorers = state.scoredThisTurn.filter((id) => id !== drawer);
  if (!scorers.length) return 'Nobody got it this time';
  return [drawer, ...scorers]
    .map((id) => {
      const name = state.playerList[id]?.username;
      const points = state.turnPoints[id] ?? 0;
      return name ? `${name} +${points}` : null;
    })
    .filter(Boolean)
    .join(' · ');
}
