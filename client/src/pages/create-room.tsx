import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import type {
  GameType,
  MinesweeperDifficulty,
  PairsBoard,
  RoomCreateRequest,
} from '../../../shared/wire-types';
import { Button, ButtonLink, Notice, SelectField, TextField } from '../ui';
import { gameInfo, lobbyPath, roomPath } from '../games/catalog';
import { plural } from '../games/plural';
import { DIFFICULTIES, boardDetail } from '../minesweeper/boards';
import { levelsFor } from '../../../shared/hush';
import {
  BOARDS as PAIRS_BOARDS,
  boardDetail as pairsBoardDetail,
} from '../pairs/boards';
import { useConnectedSession } from '../net/session';
import { REQUEST_TIMEOUT_MS } from '../net/socket';
import { ConnectionLost } from '../shell/connection-lost';
import { FormPage } from '../shell/form-page';
import { Page } from '../shell/page';
import { Stage } from '../shell/stage';
import { StatusLine } from '../shell/status-line';
import { LobbyHeading, lobbyHeading } from './lobby';

/** The server's limits. */
const ROOM_NAME_MAX_LENGTH = 40;
const PASSWORD_MAX_LENGTH = 20;
const ROUNDS = [1, 2, 3, 4] as const;
const HANDS = [5, 10] as const;
const WORDS = [3, 5] as const;

/**
 * DL04-DL06, DL10, DL11, ML04-ML06, ML10, MO05, T10, PR08, HU09, DW11: a new
 * room, with its settings.
 */
export default function CreateRoomPage({ gameType }: { gameType: GameType }) {
  const game = gameInfo(gameType);
  const { socket, lost, name } = useConnectedSession();
  const navigate = useNavigate();

  const [roomName, setRoomName] = useState(() =>
    `${name}’s room`.slice(0, ROOM_NAME_MAX_LENGTH),
  );
  const [nameMissing, setNameMissing] = useState(false);
  const nameField = useRef<HTMLInputElement>(null);
  const [seats, setSeats] = useState(game.maxPlayers);
  const [rounds, setRounds] = useState(2);
  const [difficulty, setDifficulty] = useState<MinesweeperDifficulty>('Small');
  const [hands, setHands] = useState(5);
  const [pairsBoard, setPairsBoard] = useState<PairsBoard>('Small');
  const [words, setWords] = useState(3);
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState<'error' | 'full' | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const trimmed = roomName.trim();
    if (!trimmed) {
      setNameMissing(true);
      nameField.current?.focus();
      return;
    }
    const request: RoomCreateRequest = {
      gameType,
      roomName: trimmed,
      username: name,
      maxPlayers: seats,
      password,
      settings:
        gameType === 'draw-and-guess'
          ? { rounds }
          : gameType === 'minesweeper'
            ? { difficulty }
            : gameType === 'make-24'
              ? { hands }
              : gameType === 'pairs'
                ? { board: pairsBoard }
                : gameType === 'daily-word'
                  ? { rounds: words }
                  : {},
    };
    setPending(true);
    setFailed(null);
    try {
      const answer = await socket
        .timeout(REQUEST_TIMEOUT_MS)
        .emitWithAck('room:create', request);
      if (answer.ok) {
        navigate(roomPath(gameType, answer.roomId), { replace: true });
        return;
      }
      setFailed(answer.error.type === 'tooManyRooms' ? 'full' : 'error');
    } catch {
      setFailed('error');
    }
    setPending(false);
  };

  const subtitle = 'Make a little space for your next game.';
  if (lost) {
    return (
      <Page>
        <LobbyHeading game={game} subtitle={subtitle} />
        <Stage>
          <ConnectionLost />
        </Stage>
      </Page>
    );
  }
  return (
    <FormPage
      heading={lobbyHeading(game, subtitle)}
      phone={{
        eyebrow: 'Make a room',
        title: (
          <>
            A little room <br />
            for you.
          </>
        ),
        subtitle: `${game.name} · room settings`,
      }}
      title="A little room for you."
      description={game.createDescription}
      onSubmit={submit}
      actions={
        pending ? undefined : (
          <>
            <Button type="submit">Create room</Button>
            <ButtonLink to={lobbyPath(gameType)} variant="secondary">
              Cancel
            </ButtonLink>
          </>
        )
      }
    >
      {failed && (
        <Notice tone="error">
          {failed === 'full'
            ? 'Zumpo is full right now. Join a room, or try again in a little while.'
            : 'We couldn’t create the room. Please try again.'}
        </Notice>
      )}
      <TextField
        label="Room name"
        ref={nameField}
        helper={`Up to ${ROOM_NAME_MAX_LENGTH} characters.`}
        error={nameMissing ? 'Give your room a name.' : undefined}
        value={roomName}
        onValueChange={(next: string) => {
          setRoomName(next);
          if (nameMissing && next.trim()) setNameMissing(false);
        }}
        maxLength={ROOM_NAME_MAX_LENGTH}
        autoComplete="off"
        name="roomName"
      />
      <SelectField
        label="Seats"
        helper={
          gameType === 'hush'
            ? // Hush has no settings of its own; its length is its seats.
              `Choose 2–${game.maxPlayers} seats. 2 players play ${levelsFor(2)} levels, ${game.maxPlayers} play ${levelsFor(game.maxPlayers)}.`
            : `Choose 2–${game.maxPlayers} seats.`
        }
        options={seatCounts(game.maxPlayers).map((count) => ({
          value: count,
          label: plural(count, 'player'),
        }))}
        value={seats}
        onValueChange={setSeats}
        name="seats"
      />
      {gameType === 'draw-and-guess' ? (
        <SelectField
          label="Rounds"
          helper="1, 2, 3 or 4 rounds."
          options={ROUNDS.map((count) => ({
            value: count,
            label: plural(count, 'round'),
          }))}
          value={rounds}
          onValueChange={setRounds}
          name="rounds"
        />
      ) : gameType === 'make-24' ? (
        <SelectField
          label="Hands"
          helper="5 or 10 hands, 60 seconds each."
          options={HANDS.map((count) => ({
            value: count,
            label: plural(count, 'hand'),
          }))}
          value={hands}
          onValueChange={setHands}
          name="hands"
        />
      ) : gameType === 'pairs' ? (
        <SelectField
          label="Board"
          helper={pairsBoardDetail(pairsBoard)}
          options={PAIRS_BOARDS.map((board) => ({
            value: board,
            label: board,
            detail: pairsBoardDetail(board),
          }))}
          value={pairsBoard}
          onValueChange={setPairsBoard}
          name="board"
        />
      ) : gameType === 'daily-word' ? (
        <SelectField
          label="Words"
          helper="3 or 5 words, 2 minutes each."
          options={WORDS.map((count) => ({
            value: count,
            label: plural(count, 'word'),
          }))}
          value={words}
          onValueChange={setWords}
          name="words"
        />
      ) : gameType === 'minesweeper' ? (
        <SelectField
          label="Board"
          helper={boardDetail(difficulty)}
          options={DIFFICULTIES.map((board) => ({
            value: board,
            label: board,
            detail: boardDetail(board),
          }))}
          value={difficulty}
          onValueChange={setDifficulty}
          name="board"
        />
      ) : null}
      <TextField
        label="Password (optional)"
        helper={`Leave blank for an open room. Up to ${PASSWORD_MAX_LENGTH} characters.`}
        type="password"
        value={password}
        onValueChange={(next: string) => setPassword(next)}
        maxLength={PASSWORD_MAX_LENGTH}
        autoComplete="new-password"
        name="password"
      />
      {pending && <StatusLine>Creating your room…</StatusLine>}
    </FormPage>
  );
}

/** 2, 3, … up to `max`: every room needs two to start. */
const seatCounts = (max: number) =>
  Array.from({ length: max - 1 }, (_, index) => index + 2);
