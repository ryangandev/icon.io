import { useNavigate } from 'react-router';
import type { AnyLobbyRoomInfo, GameType } from '../../../shared/wire-types';
import { ButtonLink, Card, RoomRow, type RoomRowStatus } from '../ui';
import {
  createRoomPath,
  gameInfo,
  roomPath,
  type GameInfo,
} from '../games/catalog';
import { roomSetting } from '../games/room-setting';
import { useMessages, type Messages } from '../i18n';
import { useLobby } from '../net/use-lobby';
import { useSession } from '../net/session';
import { initialsOf, toneOf } from '../players/avatar';
import { ConnectionLost } from '../shell/connection-lost';
import { NameMenuButton } from '../shell/name-menu';
import { Page } from '../shell/page';
import { PageHeading, type PageHeadingProps } from '../shell/page-heading';
import { PHONE, useMediaQuery } from '../shell/use-media-query';
import styles from './lobby.module.css';

/** DL01-DL03, ML01-ML03, MO04: a game's rooms, live. */
export default function LobbyPage({ gameType }: { gameType: GameType }) {
  const game = gameInfo(gameType);
  const m = useMessages();
  const gameName = m.games.of[gameType].name;
  const { lost, name } = useSession();
  const rooms = useLobby(gameType);
  const phone = useMediaQuery(PHONE);

  return (
    <Page>
      {phone ? (
        // A phone counts the rooms up here rather than under the list.
        <PageHeading
          eyebrow={m.lobby.playTogether}
          title={m.lobby.findRoom}
          subtitle={
            rooms ? `${gameName} · ${m.lobby.count(rooms.length)}` : gameName
          }
        />
      ) : (
        <LobbyHeading game={game} subtitle={m.lobby.subtitle} />
      )}
      {lost ? (
        <ConnectionLost />
      ) : (
        <>
          <div className={styles.actions}>
            <ButtonLink to="/" variant="secondary" icon="back">
              {m.shell.backToGames}
            </ButtonLink>
            {phone ? (
              <ButtonLink to={createRoomPath(gameType)}>
                {m.lobby.createRoom}
              </ButtonLink>
            ) : (
              <div className={styles.end}>
                <NameMenuButton variant="quiet">
                  {m.lobby.playingAs(name)}
                </NameMenuButton>
                <ButtonLink to={createRoomPath(gameType)}>
                  {m.lobby.createRoom}
                </ButtonLink>
              </div>
            )}
          </div>
          {phone && (
            // A row of its own on a phone, its icon on the content's edge.
            <div className={styles.playingAs}>
              <NameMenuButton variant="quiet">
                {m.lobby.playingAs(name)}
              </NameMenuButton>
            </div>
          )}
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
  m: Messages,
): PageHeadingProps {
  return {
    eyebrow: m.lobby.playTogether,
    title: m.lobby.title(m.games.of[game.type].name),
    subtitle,
  };
}

export function LobbyHeading({
  game,
  subtitle,
}: {
  game: GameInfo;
  subtitle: string;
}) {
  const m = useMessages();
  return <PageHeading {...lobbyHeading(game, subtitle, m)} />;
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
  const m = useMessages();
  return (
    <>
      <ul className={styles.list} aria-label={m.lobby.rooms}>
        {rooms.map((room) => (
          <RoomRow
            key={room.roomId}
            name={room.roomName}
            details={m.lobby.hostedBy(
              room.owner.username,
              roomSetting(room, m),
            )}
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
        <p className={styles.count}>{m.lobby.liveCount(rooms.length)}</p>
      )}
    </>
  );
}

function Empty({ gameType }: { gameType: GameType }) {
  const m = useMessages();
  return (
    <Card
      kind="panel"
      title={m.lobby.emptyTitle}
      description={m.lobby.emptyDescription}
      actions={
        <ButtonLink to={createRoomPath(gameType)}>
          {m.lobby.createFirstRoom}
        </ButtonLink>
      }
    />
  );
}

function Loading() {
  const m = useMessages();
  return (
    <>
      <Card
        kind="panel"
        title={m.lobby.loadingTitle}
        description={m.lobby.loadingDescription}
        busy
      />
      <div className={styles.skeleton} aria-hidden="true" />
      <div className={styles.skeleton} aria-hidden="true" />
      <div className={styles.skeleton} aria-hidden="true" />
    </>
  );
}

function Rules({ game }: { game: GameInfo }) {
  const m = useMessages();
  const text = m.games.of[game.type];
  return (
    <aside className={styles.rules} aria-labelledby="lobby-rules">
      <h2 id="lobby-rules" className={styles.rulesTitle}>
        {m.shell.nav.howToPlay}
      </h2>
      <p className={styles.rulesText}>{text.lobbySummary}</p>
      <p className={styles.rulesText}>{text.lobbyFacts.join('\n')}</p>
    </aside>
  );
}
