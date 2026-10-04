import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useBlocker, useNavigate, type Location } from 'react-router';
import type { GameType } from '../../../shared/wire-types';
import { Button, ButtonLink, Card, TextField } from '../ui';
import { gameInfo, lobbyPath, roomPath } from '../games/catalog';
import { DrawAndGuessRoom } from '../draw-and-guess/room';
import { MinesweeperRoom } from '../minesweeper/room';
import { useSession } from '../net/session';
import { REQUEST_TIMEOUT_MS } from '../net/socket';
import { useLobby } from '../net/use-lobby';
import { useRoom, type RoomConnection, type Snapshot } from '../net/use-room';
import { ConnectionFailed } from '../shell/connection-failed';
import { FormPage } from '../shell/form-page';
import { Page } from '../shell/page';
import { Stage } from '../shell/stage';
import { StatusLine } from '../shell/status-line';
import { PHONE, useMediaQuery } from '../shell/use-media-query';
import { LobbyHeading, lobbyHeading } from '../pages/lobby';
import { Confetti } from './confetti';
import { InviteDialog, LeaveDialog } from './dialogs';
import { RoomContext, type Room } from './room-context';

/**
 * /games/:game/rooms/:roomId: takes a seat, asking for a password if the room
 * has one, and shows the room; or says why it cannot.
 */
export default function RoomPage({
  gameType,
  roomId,
}: {
  gameType: GameType;
  roomId: string;
}) {
  const connection = useRoom(roomId);
  const { stage } = connection;

  switch (stage.kind) {
    case 'connecting':
      return (
        <Page>
          <Stage>
            <Card
              title="Getting the room ready…"
              description="Connecting to Zumpo. This normally takes a moment."
            >
              <StatusLine>Connecting…</StatusLine>
            </Card>
          </Stage>
        </Page>
      );
    case 'failed':
      return (
        <Page>
          <Stage>
            <ConnectionFailed />
          </Stage>
        </Page>
      );
    case 'password':
      return (
        <PasswordPage
          gameType={gameType}
          roomId={roomId}
          rejected={stage.rejected}
          pending={stage.pending}
          onSubmit={connection.submitPassword}
        />
      );
    case 'unavailable':
      return (
        <Page>
          <LobbyHeading
            game={gameInfo(gameType)}
            subtitle="Join a room or make one for your friends."
          />
          <Stage>
            <Card
              title="That room moved on."
              description="It filled up, started playing, or closed before you joined. Choose another room."
              actions={
                <ButtonLink to={lobbyPath(gameType)}>Back to rooms</ButtonLink>
              }
            />
          </Stage>
        </Page>
      );
    case 'not-found':
      return (
        <Page>
          <Stage>
            <Card
              title="This room has packed up."
              description="The room no longer exists. Find another room or start your own."
              actions={
                <ButtonLink to={lobbyPath(gameType)}>Back to rooms</ButtonLink>
              }
            />
          </Stage>
        </Page>
      );
    case 'expired':
      return <ExpiredPage gameType={gameType} />;
    case 'seated':
      // A link with the wrong game in it still reaches the room.
      if (stage.snapshot.state.gameType !== gameType) {
        return (
          <Navigate
            to={roomPath(stage.snapshot.state.gameType, roomId)}
            replace
          />
        );
      }
      return (
        <SeatedRoom
          snapshot={stage.snapshot}
          reconnecting={stage.reconnecting}
          connection={connection}
        />
      );
  }
}

/** P08: the seat was released while this player was away. */
function ExpiredPage({ gameType }: { gameType: GameType }) {
  return (
    <Page>
      <Stage>
        <Card
          title="Let’s find you a fresh start."
          description="We couldn’t reconnect. Your seat may have been released. You can return to the room list."
          actions={
            <>
              <ButtonLink to={lobbyPath(gameType)}>Back to rooms</ButtonLink>
              <ButtonLink to="/games" variant="secondary" icon="back">
                Back to games
              </ButtonLink>
            </>
          }
        />
      </Stage>
    </Page>
  );
}

/** DL07, DL08, MO06: a private room's password. */
function PasswordPage({
  gameType,
  roomId,
  rejected,
  pending,
  onSubmit,
}: {
  gameType: GameType;
  roomId: string;
  rejected: boolean;
  pending: boolean;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const phone = useMediaQuery(PHONE);
  // The buttons stand aside while the request is in flight; a refusal hands
  // focus back to the field, the wrong guess selected, ready to retype.
  useEffect(() => {
    if (!rejected || pending) return;
    field.current?.focus();
    field.current?.select();
  }, [rejected, pending]);
  // The lobby knows the room's name; a link alone does not.
  const rooms = useLobby(gameType);
  const roomName = rooms?.find((room) => room.roomId === roomId)?.roomName;
  const description = `Enter the password for ${roomName ?? 'this room'}.`;

  return (
    <FormPage
      heading={lobbyHeading(
        gameInfo(gameType),
        'Join a room or make one for your friends.',
      )}
      phone={{ eyebrow: 'Come on in', subtitle: description }}
      title="This room has a secret."
      description={description}
      onSubmit={(event) => {
        event.preventDefault();
        if (!pending) onSubmit(password);
      }}
      actions={
        pending ? undefined : (
          <>
            <Button type="submit">Join room</Button>
            <ButtonLink
              to={lobbyPath(gameType)}
              variant="secondary"
              icon="back"
            >
              Back to rooms
            </ButtonLink>
          </>
        )
      }
    >
      <TextField
        label="Room password"
        helper={
          phone
            ? 'Ask the host for the password.'
            : 'Ask the host for the room password.'
        }
        error={rejected ? 'That password didn’t work. Try again.' : undefined}
        ref={field}
        type="password"
        value={password}
        onValueChange={(next: string) => setPassword(next)}
        autoComplete="off"
        autoFocus
        name="password"
      />
      {pending && <StatusLine>Joining the room…</StatusLine>}
    </FormPage>
  );
}

/** Marks a navigation as the room's own Leave room button. */
const LEAVE_ROOM = 'leave-room';

const isLeaveRoom = (location: Location | undefined) =>
  (location?.state as { via?: string } | null)?.via === LEAVE_ROOM;

/**
 * In the room. Any way out of the page passes through here and gives the seat
 * up before the page goes. Leave room between games goes at once; anything
 * else asks first: Leave room mid-game (P11), and the wordmark, the browser's
 * back button or Change name at any time (P11, P16).
 */
function SeatedRoom({
  snapshot,
  reconnecting,
  connection,
}: {
  snapshot: Snapshot;
  reconnecting: boolean;
  connection: RoomConnection;
}) {
  const { socket, playerId, reconnectGraceMs } = useSession();
  const navigate = useNavigate();
  const { state, receivedAt } = snapshot;
  const [inviting, setInviting] = useState(false);
  const [starting, setStarting] = useState(false);

  // A game that ends while the room is open is celebrated; a finished game
  // found on arrival or after a refresh is not. Each one gets its own burst.
  const [wasPlaying, setWasPlaying] = useState(state.isGameStarted);
  const [celebrations, setCelebrations] = useState(0);
  if (state.isGameStarted !== wasPlaying) {
    setWasPlaying(state.isGameStarted);
    if (!state.isGameStarted && state.lastGame && !state.lastGame.endedEarly) {
      setCelebrations((count) => count + 1);
    }
  }

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      currentLocation.pathname !== nextLocation.pathname,
  );
  const blocked = blocker.state === 'blocked';
  // Only Leave room between games is sure to mean it; anything else may be a
  // slip, so it asks.
  const sure = blocked && !state.isGameStarted && isLeaveRoom(blocker.location);
  const { leave } = connection;

  useEffect(() => {
    if (sure) {
      leave();
      blocker.proceed?.();
    }
  }, [sure, leave, blocker]);

  const startGame = useCallback(async () => {
    setStarting(true);
    try {
      await socket
        .timeout(REQUEST_TIMEOUT_MS)
        .emitWithAck('game:start', state.roomId);
    } catch {
      // No answer; the button comes back so the host can try again.
    }
    setStarting(false);
  }, [socket, state.roomId]);

  const me = state.playerList[playerId];

  const room = useMemo<Room | null>(
    () =>
      me
        ? {
            state,
            receivedAt,
            reconnecting,
            reconnectGraceMs,
            playerId,
            me,
            isHost: state.owner.playerId === playerId,
            chat: connection.chat,
            canvas: connection.canvas,
            socket,
            sendChat: (text) => socket.emit('chat:send', state.roomId, text),
            openInvite: () => setInviting(true),
            leave: () =>
              navigate(lobbyPath(state.gameType), {
                state: { via: LEAVE_ROOM },
              }),
            startGame,
            starting,
          }
        : null,
    [
      state,
      receivedAt,
      reconnecting,
      reconnectGraceMs,
      playerId,
      me,
      connection.chat,
      connection.canvas,
      socket,
      navigate,
      startGame,
      starting,
    ],
  );

  // A snapshot without us in it means the seat is gone.
  if (!room) return <ExpiredPage gameType={state.gameType} />;

  return (
    <RoomContext.Provider value={room}>
      {state.gameType === 'draw-and-guess' ? (
        <DrawAndGuessRoom />
      ) : (
        <MinesweeperRoom />
      )}
      {celebrations > 0 && <Confetti key={celebrations} />}
      <InviteDialog
        open={inviting}
        onOpenChange={setInviting}
        roomName={state.roomName}
        link={`${window.location.origin}${roomPath(state.gameType, state.roomId)}`}
      />
      <LeaveDialog
        open={blocked && !sure}
        roomName={state.roomName}
        inGame={state.isGameStarted}
        points={room.me.points}
        onStay={() => blocker.reset?.()}
        onLeave={() => {
          leave();
          blocker.proceed?.();
        }}
      />
    </RoomContext.Provider>
  );
}
