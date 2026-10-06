import { useNavigate } from 'react-router';
import type { AnyLobbyRoomInfo, GameType } from '../../../shared/wire-types';
import { ButtonLink, Card, RoomRow, type RoomRowStatus } from '../ui';
import {
  createRoomPath,
  gameInfo,
  roomPath,
  type GameInfo,
} from '../games/catalog';
import { plural } from '../games/plural';
import { roomSetting } from '../games/room-setting';
import { useLobby } from '../net/use-lobby';
import { useSession } from '../net/session';
import { initialsOf, toneOf } from '../players/avatar';
import { ConnectionLost } from '../shell/connection-lost';
import { Page } from '../shell/page';
import { PageHeading, type PageHeadingProps } from '../shell/page-heading';
import { PHONE, useMediaQuery } from '../shell/use-media-query';
import styles from './lobby.module.css';

/** DL01-DL03, ML01-ML03, MO04: a game's rooms, live. */
export default function LobbyPage({ gameType }: { gameType: GameType }) {
  const game = gameInfo(gameType);
  const { lost } = useSession();
  const rooms = useLobby(gameType);
  const phone = useMediaQuery(PHONE);

  return (
    <Page>
      {phone ? (
        // A phone counts the rooms up here rather than under the list.
        <PageHeading
          eyebrow="Play together"
          title="Find your room."
          subtitle={
            rooms ? `${game.name} · ${plural(rooms.length, 'room')}` : game.name
          }
        />
      ) : (
        <LobbyHeading
          game={game}
          subtitle="Join a room or make one for your friends."
        />
      )}
      {lost ? (
        <ConnectionLost />
      ) : (
        <>
          <div className={styles.actions}>
            <ButtonLink to="/" variant="secondary" icon="back">
              Back to games
            </ButtonLink>
            <ButtonLink to={createRoomPath(gameType)}>Create a room</ButtonLink>
          </div>
          <div className={styles.layout}>
            <div className={styles.rooms}>
              {rooms === null ? (
                <Loading />
              ) : rooms.length === 0 ? (
                <Empty gameType={gameType} />
              ) : (
                <RoomList rooms={rooms} counted={!phone} />
              )}
            </div>
            <Rules game={game} />
          </div>
        </>
      )}
    </Page>
  );
}

/** A game's rooms pages share one heading on a wide screen. */
export function lobbyHeading(
  game: GameInfo,
  subtitle: string,
): PageHeadingProps {
  return { eyebrow: 'Play together', title: `${game.name} rooms`, subtitle };
}

export function LobbyHeading({
  game,
  subtitle,
}: {
  game: GameInfo;
  subtitle: string;
}) {
  return <PageHeading {...lobbyHeading(game, subtitle)} />;
}

function statusOf(room: AnyLobbyRoomInfo): RoomRowStatus {
  if (room.status === 'In Progress') return 'playing';
  if (room.status === 'Full') return 'full';
  return room.hasPassword ? 'private' : 'open';
}

function RoomList({
  rooms,
  counted,
}: {
  rooms: AnyLobbyRoomInfo[];
  /** Says how many rooms there are, under the list. */
  counted: boolean;
}) {
  const navigate = useNavigate();
  return (
    <>
      <ul className={styles.list} aria-label="Rooms">
        {rooms.map((room) => (
          <RoomRow
            key={room.roomId}
            name={room.roomName}
            details={`Hosted by ${room.owner.username} · ${roomSetting(room)}`}
            host={{
              initials: initialsOf(room.owner.username),
              tone: toneOf(room.owner.username),
            }}
            players={room.currentPlayerCount}
            seats={room.maxPlayers}
            status={statusOf(room)}
            onJoin={() => navigate(roomPath(room.gameType, room.roomId))}
          />
        ))}
      </ul>
      {counted && (
        <p className={styles.count}>
          {plural(rooms.length, 'room')} · Updates live
        </p>
      )}
    </>
  );
}

function Empty({ gameType }: { gameType: GameType }) {
  return (
    <Card
      kind="panel"
      title="A little quiet in here."
      description="Be the first to make a room. Bring a friend and get playing."
      actions={
        <ButtonLink to={createRoomPath(gameType)}>
          Create the first room
        </ButtonLink>
      }
    />
  );
}

function Loading() {
  return (
    <>
      <Card
        kind="panel"
        title="Finding your people…"
        description="Connecting to the room list."
        busy
      />
      <div className={styles.skeleton} aria-hidden="true" />
      <div className={styles.skeleton} aria-hidden="true" />
      <div className={styles.skeleton} aria-hidden="true" />
    </>
  );
}

function Rules({ game }: { game: GameInfo }) {
  return (
    <aside className={styles.rules} aria-labelledby="lobby-rules">
      <h2 id="lobby-rules" className={styles.rulesTitle}>
        How to play
      </h2>
      <p className={styles.rulesText}>{game.lobbySummary}</p>
      <p className={styles.rulesText}>{game.lobbyFacts.join('\n')}</p>
    </aside>
  );
}
