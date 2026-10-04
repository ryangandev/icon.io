import { useNavigate } from 'react-router';
import type { AnyLobbyRoomInfo, GameType } from '../../../shared/wire-types';
import { ButtonLink, RoomRow, type RoomRowStatus } from '../ui';
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
import { ConnectionFailed } from '../shell/connection-failed';
import { Page } from '../shell/page';
import { PageHeading } from '../shell/page-heading';
import styles from './lobby.module.css';

/** DL01-DL03, ML01-ML03: a game's rooms, live. */
export default function LobbyPage({ gameType }: { gameType: GameType }) {
  const game = gameInfo(gameType);
  const { status } = useSession();
  const rooms = useLobby(gameType);

  return (
    <Page>
      <LobbyHeading
        game={game}
        subtitle="Join a room or make one for your friends."
      />
      {status === 'failed' ? (
        <ConnectionFailed />
      ) : (
        <>
          <div className={styles.actions}>
            <ButtonLink to="/games" variant="secondary" icon="back">
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
                <RoomList rooms={rooms} />
              )}
            </div>
            <Rules game={game} />
          </div>
        </>
      )}
    </Page>
  );
}

export function LobbyHeading({
  game,
  subtitle,
}: {
  game: GameInfo;
  subtitle: string;
}) {
  return (
    <PageHeading
      eyebrow="Play together"
      title={`${game.name} rooms`}
      subtitle={subtitle}
    />
  );
}

function statusOf(room: AnyLobbyRoomInfo): RoomRowStatus {
  if (room.status === 'In Progress') return 'playing';
  if (room.status === 'Full') return 'full';
  return room.hasPassword ? 'private' : 'open';
}

function RoomList({ rooms }: { rooms: AnyLobbyRoomInfo[] }) {
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
      <p className={styles.count}>
        {plural(rooms.length, 'room')} · Updates live
      </p>
    </>
  );
}

function Empty({ gameType }: { gameType: GameType }) {
  return (
    <section className={styles.panel} aria-labelledby="lobby-empty">
      <h2 id="lobby-empty" className={styles.panelTitle}>
        A little quiet in here.
      </h2>
      <p className={styles.panelText}>
        Be the first to make a room. Bring a friend and get playing.
      </p>
      <ButtonLink to={createRoomPath(gameType)}>
        Create the first room
      </ButtonLink>
    </section>
  );
}

function Loading() {
  return (
    <>
      <section
        className={styles.panel}
        aria-labelledby="lobby-loading"
        aria-busy="true"
      >
        <h2 id="lobby-loading" className={styles.panelTitle}>
          Finding your people…
        </h2>
        <p className={styles.panelText}>Connecting to the room list.</p>
      </section>
      <div className={styles.skeleton} aria-hidden="true" />
      <div className={styles.skeleton} aria-hidden="true" />
      <div className={styles.skeleton} aria-hidden="true" />
    </>
  );
}

function Rules({ game }: { game: GameInfo }) {
  return (
    <aside className={styles.rules} aria-labelledby="lobby-rules">
      <h2 id="lobby-rules" className={styles.panelTitle}>
        How to play
      </h2>
      <p className={styles.rulesText}>{game.lobbySummary}</p>
      <p className={styles.rulesText}>{game.lobbyFacts.join('\n')}</p>
    </aside>
  );
}
