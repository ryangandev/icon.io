import { useState, type ReactNode } from 'react';
import {
  ChatInput,
  MobileTabs,
  Notice,
  PlayerRow,
  RoomBar,
  Scoreboard,
  type PlayerRowProps,
  type GlyphName,
  type TagTone,
} from '../ui';
import { gameInfo } from '../games/catalog';
import { useMessages } from '../i18n';
import { initialsOf, toneOf } from '../players/avatar';
import { Page, useViewer } from '../shell/page';
import { PHONE, useMediaQuery } from '../shell/use-media-query';
import { RulesDialog } from './dialogs';
import { RoomChat } from './room-chat';
import { useRoomContext } from './room-context';
import type { Seat } from './players';
import styles from './room-layout.module.css';

export interface PlayerLine {
  seat: Seat;
  status: string;
  statusIcon?: PlayerRowProps['statusIcon'];
  state?: PlayerRowProps['state'];
}

export interface RoomLayoutProps {
  /** The phase tag beside the room's name: "Waiting room", "Round 2 of 2". */
  phase: { tone: TagTone; label: string };
  /** A pending notice over the room, such as a drawer who dropped. */
  notice?: ReactNode;
  /** The game: turn bar and canvas or board, or a panel between games. */
  stage: ReactNode;
  players: readonly PlayerLine[];
  chat: {
    placeholder: string;
    lockedReason?: string;
    /** The game's own Alert icon in the chat, as Chat message allows. */
    alertIcon?: GlyphName;
  };
  /**
   * On a phone, the chat input repeated under the board, so a guess needs no
   * switch to the Chat tab: its accessible name, or nothing for no input.
   */
  boardInput?: string;
  /**
   * The scoreboard's points; off where everybody's are the same, as in Hush,
   * whose team scores together and whose rows say what each player holds.
   */
  showScores?: boolean;
  /** On a phone, more under the scoreboard on the Players tab: the race. */
  playersAside?: ReactNode;
}

type View = 'board' | 'players' | 'chat';

/**
 * A seated room's screen: the room bar, the game, the scoreboard and the
 * chat; on a phone, the three as tabs. How to play opens over the room. While
 * reconnecting it says so and holds still.
 */
export function RoomLayout({
  phase,
  notice,
  stage,
  players,
  chat,
  boardInput,
  showScores = true,
  playersAside,
}: RoomLayoutProps) {
  const room = useRoomContext();
  const { state, reconnecting, reconnectGraceMs } = room;
  const game = gameInfo(state.gameType);
  const m = useMessages();
  const phone = useMediaQuery(PHONE);
  const [view, setView] = useState<View>('board');
  const [rules, setRules] = useState(false);
  const { viewer, viewerMenu } = useViewer({
    seatName: state.playerList[room.playerId]?.username,
  });

  const input = {
    onSend: room.sendChat,
    placeholder: chat.placeholder,
    lockedReason: reconnecting ? 'Reconnecting…' : chat.lockedReason,
  };

  const scoreboard = (
    <Scoreboard players={players.length} seats={state.maxPlayers}>
      {players.map(({ seat, status, statusIcon, state: rowState }) => (
        <PlayerRow
          key={seat.playerId}
          name={seat.username}
          initials={initialsOf(seat.username)}
          tone={toneOf(seat.username)}
          status={status}
          statusIcon={statusIcon}
          score={showScores ? seat.points : undefined}
          host={seat.playerId === state.owner.playerId}
          you={seat.playerId === room.playerId}
          state={rowState}
        />
      ))}
    </Scoreboard>
  );

  const chatPanel = <RoomChat input={input} alertIcon={chat.alertIcon} />;

  const seconds = Math.round(reconnectGraceMs / 1000);

  return (
    <Page
      header={
        <RoomBar
          layout={phone ? 'phone' : 'desktop'}
          game={m.games.of[state.gameType].name}
          room={state.roomName}
          phase={phase}
          onHowToPlay={() => setRules(true)}
          onLeave={reconnecting ? undefined : room.leave}
          viewer={viewer}
          viewerMenu={viewerMenu}
        />
      }
    >
      {reconnecting ? (
        <Notice tone="pending">
          Reconnecting to {state.roomName}… Your seat and score are kept for{' '}
          {seconds} seconds.
        </Notice>
      ) : (
        notice
      )}
      {phone ? (
        <MobileTabs<View>
          value={view}
          onValueChange={setView}
          tabs={[
            {
              value: 'board',
              label: 'Board',
              panel: (
                <div className={styles.stage}>
                  {stage}
                  {boardInput && <ChatInput {...input} label={boardInput} />}
                </div>
              ),
            },
            {
              value: 'players',
              label: `Players · ${players.length}`,
              panel: playersAside ? (
                <div className={styles.side}>
                  {scoreboard}
                  {playersAside}
                </div>
              ) : (
                scoreboard
              ),
            },
            { value: 'chat', label: 'Chat', panel: chatPanel },
          ]}
        />
      ) : (
        <div className={styles.room}>
          <div className={styles.stage}>{stage}</div>
          <div className={styles.side}>
            {scoreboard}
            {chatPanel}
          </div>
        </div>
      )}
      <RulesDialog open={rules} onOpenChange={setRules} game={game} />
    </Page>
  );
}
