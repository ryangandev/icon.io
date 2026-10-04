import type { ReactNode } from 'react';
import type { GameSummary } from '../../../shared/wire-types';
import { Button, ButtonLink, PlayerRow } from '../ui';
import { gameInfo, lobbyPath } from '../games/catalog';
import { initialsOf, toneOf } from '../players/avatar';
import { StatusLine } from '../shell/status-line';
import { ordinal } from './players';
import { useRoomContext } from './room-context';
import styles from './panels.module.css';

/** The paper panel that stands in for the game between games. */
export function RoomPanel({
  title,
  children,
  actions,
}: {
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className={styles.panel} aria-labelledby="room-panel-title">
      <h2 id="room-panel-title" className={styles.title}>
        {title}
      </h2>
      <p className={styles.body}>{children}</p>
      {actions && <div className={styles.actions}>{actions}</div>}
    </section>
  );
}

function InviteButton({ primary = false }: { primary?: boolean }) {
  const { openInvite } = useRoomContext();
  return (
    <Button
      variant={primary ? 'primary' : 'secondary'}
      icon="link"
      onClick={openInvite}
    >
      Invite friends
    </Button>
  );
}

/**
 * D01-D03, M01-M03: before a game. The host starts once there are two; a
 * guest waits for the host.
 */
export function WaitingPanel({
  aloneTitle,
  setup,
  guestSetup,
  onStart,
  starting,
}: {
  /** The host's title while alone. */
  aloneTitle: string;
  /** For the host: "4 players, 2 rounds. The word category is…". */
  setup: string;
  /** For a guest: "4 players, 2 rounds." */
  guestSetup: string;
  onStart: () => void;
  starting: boolean;
}) {
  const { state, isHost } = useRoomContext();
  const game = gameInfo(state.gameType);
  const count = Object.keys(state.playerList).length;

  if (!isHost) {
    return (
      <RoomPanel
        title={`Waiting for ${state.owner.username} to start.`}
        actions={<InviteButton />}
      >
        {guestSetup} Only the host can start the game.
      </RoomPanel>
    );
  }
  if (count < 2) {
    return (
      <RoomPanel title={aloneTitle} actions={<InviteButton primary />}>
        {game.name} needs at least 2 players. Share the room so a friend can
        join, and the game can start.
      </RoomPanel>
    );
  }
  return (
    <RoomPanel
      title="Everyone’s here?"
      actions={
        starting ? (
          <StatusLine>Starting the game…</StatusLine>
        ) : (
          <>
            <Button onClick={onStart}>Start game</Button>
            <InviteButton />
          </>
        )
      }
    >
      {setup}
    </RoomPanel>
  );
}

/** D15, M16: the game ended because everyone else left. */
export function EndedEarlyPanel() {
  const { state } = useRoomContext();
  const game = gameInfo(state.gameType);
  return (
    <RoomPanel
      title="Everyone else left."
      actions={
        <>
          <InviteButton primary />
          <ButtonLink
            to={lobbyPath(state.gameType)}
            variant="secondary"
            icon="back"
          >
            Back to rooms
          </ButtonLink>
        </>
      }
    >
      {game.name} needs at least 2 players, so the game has ended. You are the
      host now: invite friends to start a new one.
    </RoomPanel>
  );
}

/**
 * D13, D14, M14, M15: the final standings. The host can play again; a guest
 * waits for them.
 */
export function ResultsPanel({
  summary,
  detail,
  onPlayAgain,
  starting,
}: {
  summary: GameSummary;
  /** "2 rounds of Animals, 8 turns." */
  detail: string;
  onPlayAgain: () => void;
  starting: boolean;
}) {
  const { state, isHost, playerId } = useRoomContext();
  const [winner] = summary.standings;
  const place = summary.standings.findIndex((s) => s.playerId === playerId) + 1;
  const count = Object.keys(state.playerList).length;

  const actions = !isHost ? (
    <StatusLine>
      Waiting for {state.owner.username} to start another game.
    </StatusLine>
  ) : starting ? (
    <StatusLine>Starting the game…</StatusLine>
  ) : count >= 2 ? (
    <>
      <Button onClick={onPlayAgain}>Play again</Button>
      <InviteButton />
    </>
  ) : (
    <InviteButton primary />
  );

  return (
    <section className={styles.results} aria-labelledby="results-title">
      <div className={styles.resultHeading}>
        <h2 id="results-title" className={styles.title}>
          {winner
            ? `${winner.username} wins with ${winner.points} points.`
            : 'Game over.'}
        </h2>
        <p className={styles.body}>
          {detail}
          {place > 1 && ` You finished ${ordinal(place)}.`}
        </p>
      </div>
      <ol className={styles.ranking}>
        {summary.standings.map((standing, index) => {
          const seat = state.playerList[standing.playerId];
          return (
            <li key={standing.playerId} className={styles.place}>
              <span className={styles.number}>{index + 1}</span>
              <ul className={styles.row}>
                <PlayerRow
                  name={standing.username}
                  initials={initialsOf(standing.username)}
                  tone={toneOf(standing.username)}
                  status={
                    index === 0 ? 'Winner' : `${ordinal(index + 1)} place`
                  }
                  score={standing.points}
                  host={standing.playerId === state.owner.playerId}
                  you={standing.playerId === playerId}
                  state={index === 0 ? 'highlight' : seat ? 'default' : 'away'}
                />
              </ul>
            </li>
          );
        })}
      </ol>
      <div className={styles.actions}>{actions}</div>
    </section>
  );
}
