import { useState, type ReactNode } from 'react';
import {
  Button,
  Chat,
  ChatInput,
  ChatMessage,
  MobileTabs,
  Notice,
  PlayerRow,
  Scoreboard,
  Tag,
  type PlayerRowProps,
  type TagTone,
} from '../ui';
import { gameInfo } from '../games/catalog';
import { initialsOf, toneOf } from '../players/avatar';
import { PHONE, useMediaQuery } from '../shell/use-media-query';
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
  /** Under the title in the waiting room: the room's settings. */
  subtitle?: string;
  /** A pending notice over the room, such as a drawer who dropped. */
  notice?: ReactNode;
  /** The game: turn bar and canvas or board, or a panel between games. */
  stage: ReactNode;
  players: readonly PlayerLine[];
  chat: { placeholder: string; lockedReason?: string };
  /**
   * On a phone, the chat input repeated under the board, so a guess needs no
   * switch to the Chat tab: its accessible name, or nothing for no input.
   */
  boardInput?: string;
}

type View = 'board' | 'players' | 'chat';

/**
 * A seated room: its heading, the game, the scoreboard and the chat; on a
 * phone, the three as tabs. While reconnecting it says so and holds still.
 */
export function RoomLayout({
  phase,
  subtitle,
  notice,
  stage,
  players,
  chat,
  boardInput,
}: RoomLayoutProps) {
  const room = useRoomContext();
  const { state, reconnecting, reconnectGraceMs } = room;
  const game = gameInfo(state.gameType);
  const phone = useMediaQuery(PHONE);
  const [view, setView] = useState<View>('board');

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
          score={seat.points}
          host={seat.playerId === state.owner.playerId}
          you={seat.playerId === room.playerId}
          state={rowState}
        />
      ))}
    </Scoreboard>
  );

  const chatPanel = (
    <Chat messageCount={room.chat.length} input={input}>
      {room.chat.map((message) => (
        <ChatMessage
          key={message.id}
          kind={message.kind}
          name={
            message.playerId === room.playerId
              ? `${message.username} (you)`
              : message.username
          }
        >
          {message.text}
        </ChatMessage>
      ))}
    </Chat>
  );

  const seconds = Math.round(reconnectGraceMs / 1000);

  return (
    <>
      <div className={styles.heading}>
        <div className={styles.identity}>
          <div className={styles.tags}>
            <Tag>{state.roomName}</Tag>
            <Tag tone={phase.tone}>{phase.label}</Tag>
          </div>
          <h1 className={styles.title}>
            {reconnecting ? 'A little pause.' : game.name}
          </h1>
          {subtitle && !reconnecting && (
            <p className={styles.subtitle}>{subtitle}</p>
          )}
        </div>
        {!reconnecting && (
          <Button
            variant="secondary"
            icon="leave"
            iconOnly={phone}
            onClick={room.leave}
          >
            Leave room
          </Button>
        )}
      </div>
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
              panel: scoreboard,
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
    </>
  );
}
