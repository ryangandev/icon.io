import type {
  HushGameSummary,
  HushLevelRecord,
  HushRoomState,
} from '../../../shared/wire-types';
import {
  Avatar,
  Button,
  HushCard,
  Tag,
  TurnBar,
  type TurnBarProps,
} from '../ui';
import { plural } from '../games/plural';
import { useSecondsLeft } from '../net/use-seconds-left';
import { initialsOf, toneOf } from '../players/avatar';
import { EndedEarlyPanel, ResultsFrame, WaitingPanel } from '../room/panels';
import { listNames, rankedPlayers, type Seat } from '../room/players';
import { useRoomContext, type Room as RoomOf } from '../room/room-context';
import { RoomLayout, type PlayerLine } from '../room/room-layout';
import { Divider, HandRow, Pile, TableHead, TablePanel } from './table';
import styles from './room.module.css';

type Room = RoomOf<HushRoomState>;
type Phase = HushRoomState['phase'];

/** The phases a level is played in: the hands are out, and it is hushed. */
const HUSHED: readonly Phase[] = ['countdown', 'playing', 'mistake', 'paused'];

const HUSHED_CHAT = 'Hush. Chat opens when the level ends.';

/** HU01-HU08: a Hush room, before, during and after a game. */
export function HushRoom() {
  const room = useRoomContext<HushRoomState>();
  const { state } = room;
  const players = rankedPlayers(state);
  const inGame = state.isGameStarted;
  const ended = !inGame ? state.lastGame : null;
  return (
    <RoomLayout
      phase={
        inGame
          ? { tone: 'blue', label: `Level ${state.level} of ${state.levels}` }
          : ended && !ended.endedEarly
            ? { tone: 'lime', label: 'Game over' }
            : ended && players.length < 2
              ? { tone: 'peach', label: 'Game ended' }
              : { tone: 'blue', label: 'Waiting room' }
      }
      stage={inGame ? <Level room={room} /> : <BetweenGames room={room} />}
      players={players.map((seat) => playerLine(state, seat))}
      chat={{
        placeholder: 'Say something…',
        lockedReason:
          inGame && HUSHED.includes(state.phase) ? HUSHED_CHAT : undefined,
      }}
      // Everybody's points are the levels the team cleared; the rows say
      // what each player holds instead.
      showScores={false}
    />
  );
}

/** A player by name, or "You" ("you" inside a sentence). */
function nameIn(room: Room, playerId: string, first = true): string {
  if (playerId === room.playerId) return first ? 'You' : 'you';
  return room.state.playerList[playerId]?.username ?? 'A player';
}

const cardsOf = (cards: readonly number[]) => listNames(cards.map(String));

function BetweenGames({ room }: { room: Room }) {
  const { state, startGame, starting } = room;
  const count = Object.keys(state.playerList).length;
  const summary = state.lastGame;

  if (summary && !summary.endedEarly) {
    return (
      <>
        <Results room={room} summary={summary} />
        {/* HU07, HU08: the last pile stays on the table. */}
        {state.pile.length > 0 && (
          <TablePanel>
            <TableHead
              title={`Level ${summary.history.at(-1)?.level ?? state.levels}`}
              note={
                summary.won
                  ? `All ${plural(state.pile.length + state.discards.length, 'card')}`
                  : 'As it ended'
              }
              lives={summary.lives}
            />
            <Pile pile={state.pile} discards={state.discards} empty="" />
          </TablePanel>
        )}
      </>
    );
  }
  if (summary?.endedEarly && count < 2) return <EndedEarlyPanel />;
  return (
    <WaitingPanel
      aloneTitle="A little better with company."
      setup={`${plural(count, 'player')}, ${plural(state.levels, 'level')}. Play every card in order, together, without a word.`}
      guestSetup={`${plural(count, 'player')}, ${plural(state.levels, 'level')}.`}
      onStart={startGame}
      starting={starting}
    />
  );
}

/** "Level 2: a life lost". */
function levelLine(record: HushLevelRecord, last: boolean, lost: boolean) {
  const prefix = `Level ${record.level}`;
  if (!record.cleared && last && lost) {
    return {
      tone: 'peach',
      icon: 'alert',
      text: `${prefix}: the last life lost`,
    } as const;
  }
  if (!record.cleared) {
    return {
      tone: 'peach',
      icon: 'alert',
      text: `${prefix}: not finished`,
    } as const;
  }
  if (record.livesLost === 0) {
    return {
      tone: 'lime',
      icon: 'check',
      text: record.lifeBack
        ? `${prefix}: clean, a life back`
        : `${prefix}: clean`,
    } as const;
  }
  return {
    tone: 'peach',
    icon: 'alert',
    text:
      record.livesLost === 1
        ? `${prefix}: a life lost`
        : `${prefix}: ${plural(record.livesLost, 'life', 'lives')} lost`,
  } as const;
}

/** HU07, HU08: the team's result. Nobody is ranked; every level is listed. */
function Results({ room, summary }: { room: Room; summary: HushGameSummary }) {
  const { startGame, starting } = room;
  const lostOn = summary.history.at(-1)?.level ?? summary.levelsCleared + 1;
  const title = summary.won
    ? `All ${plural(summary.levels, 'level')} cleared.`
    : `Out of lives on level ${lostOn}.`;
  const detail = summary.won
    ? summary.lives === 0
      ? 'Together.'
      : `Together, with ${plural(summary.lives, 'life', 'lives')} to spare.`
    : `${summary.levelsCleared} of ${plural(summary.levels, 'level')} cleared, together.`;

  return (
    <ResultsFrame
      title={title}
      detail={detail}
      onPlayAgain={startGame}
      starting={starting}
    >
      <section className={styles.block} aria-labelledby="hush-levels">
        <h3 id="hush-levels" className={styles.blockTitle}>
          Level by level
        </h3>
        <ul className={styles.levels}>
          {summary.history.map((record, index) => {
            const line = levelLine(
              record,
              index === summary.history.length - 1,
              !summary.won,
            );
            return (
              <li key={record.level}>
                <Tag tone={line.tone} icon={line.icon}>
                  {line.text}
                </Tag>
              </li>
            );
          })}
        </ul>
      </section>
      {summary.won ? (
        <section className={styles.block} aria-labelledby="hush-team">
          <h3 id="hush-team" className={styles.blockTitle}>
            Played by
          </h3>
          <ul className={styles.team}>
            {summary.standings.map(({ playerId, username }) => (
              <li key={playerId} className={styles.member}>
                <Avatar
                  initials={initialsOf(username)}
                  tone={toneOf(username)}
                />
                <span className={styles.name}>{username}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className={styles.block} aria-labelledby="hush-held">
          <h3 id="hush-held" className={styles.blockTitle}>
            Still held
          </h3>
          <ul className={styles.held}>
            {summary.standings.map(({ playerId, username }) => {
              const cards =
                summary.held.find((h) => h.playerId === playerId)?.cards ?? [];
              return (
                <li key={playerId} className={styles.holder}>
                  <Avatar
                    initials={initialsOf(username)}
                    tone={toneOf(username)}
                  />
                  <span className={styles.name}>{username}</span>
                  {cards.length > 0 ? (
                    <ol
                      className={styles.heldCards}
                      aria-label={`${username} held`}
                    >
                      {cards.map((card) => (
                        <li key={card}>
                          <HushCard value={card} size="small" />
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <span className={styles.nothing}>Nothing left</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </ResultsFrame>
  );
}

/** HU01-HU06: a level: the turn bar, then the table. */
function Level({ room }: { room: Room }) {
  const { state, receivedAt, reconnecting } = room;
  const seconds = useSecondsLeft(state.phaseEndsInMs, receivedAt, reconnecting);
  return (
    <>
      <TurnBar {...turnBar(room, seconds)} />
      <TablePanel>
        <TableHead {...tableHead(state)} />
        <Pile
          pile={state.pile}
          discards={state.discards}
          empty={
            state.phase === 'ready'
              ? 'Cards are dealt when everyone is ready'
              : 'The lowest card in the room goes here'
          }
        />
        <Divider />
        <Hand room={room} />
      </TablePanel>
    </>
  );
}

const cardsLeft = (state: HushRoomState) =>
  Object.values(state.table).reduce((sum, seat) => sum + seat.held, 0);

function tableHead(state: HushRoomState) {
  const { phase, level, lives, pile, discards } = state;
  if (phase === 'ready') {
    return {
      title: `Level ${level}`,
      note: `${plural(level, 'card')} each`,
      lives,
    };
  }
  if (phase === 'cleared') {
    return {
      title: 'The pile',
      note:
        discards.length === 0
          ? `All ${plural(pile.length, 'card')} played`
          : `${plural(pile.length, 'card')} played, ${discards.length} discarded`,
      lives,
    };
  }
  const left = cardsLeft(state);
  return {
    title: 'The pile',
    note:
      pile.length === 0
        ? 'Lowest first'
        : left === 0
          ? 'No cards left'
          : `${plural(left, 'card')} to go`,
    lives,
  };
}

/** Who is away holding cards: the level waits for them. */
const awayHolders = (state: HushRoomState) =>
  Object.entries(state.playerList)
    .filter(
      ([playerId, player]) =>
        !player.isConnected && (state.table[playerId]?.held ?? 0) > 0,
    )
    .map(([playerId]) => playerId);

/** The viewer's side of the table, phase by phase. */
function Hand({ room }: { room: Room }) {
  const { state, playerId, socket, reconnecting } = room;
  const { phase, hand } = state;
  const ready = state.table[playerId]?.ready ?? false;

  switch (phase) {
    case 'ready':
      return (
        <HandRow
          label={ready ? 'You’re ready' : 'Ready when you are'}
          message="The chat locks when the level starts, and opens when it ends."
          action={
            !ready && !reconnecting ? (
              <Button onClick={() => socket.emit('hush:ready', state.roomId)}>
                I’m ready
              </Button>
            ) : undefined
          }
          status={ready ? 'Waiting for the others.' : undefined}
        />
      );
    case 'cleared':
      return (
        <HandRow
          label="Next up"
          message={`Level ${state.level + 1} deals ${plural(state.level + 1, 'card')} each. Everyone presses Ready again.`}
        />
      );
    default:
      break;
  }

  if (hand.length === 0) {
    return (
      <HandRow
        label="Your hand"
        message="Nothing left to play. Watch the pile, without a word."
      />
    );
  }
  if (phase === 'playing' && !reconnecting) {
    const next = hand[0];
    return (
      <HandRow
        label="Your hand"
        cards={hand}
        action={
          <Button onClick={() => socket.emit('hush:play', state.roomId, next)}>
            Play {next}
          </Button>
        }
        status="Only your lowest card can be played."
      />
    );
  }
  const away = awayHolders(state).map((id) => nameIn(room, id));
  return (
    <HandRow
      label="Your hand"
      cards={hand}
      status={
        phase === 'countdown'
          ? 'Play opens in a moment.'
          : phase === 'paused'
            ? `Play goes on with a countdown when ${listNames(away)} ${away.length === 1 ? 'is' : 'are'} back.`
            : 'Play goes on in a moment.'
      }
    />
  );
}

function turnBar(room: Room, seconds: number): TurnBarProps {
  const { state, reconnecting, playerId } = room;
  const label = `Level ${state.level} of ${state.levels}`;
  // Nobody acts while any of these clocks runs, so each one waits.
  const clock = (forWhat: string) => ({
    seconds,
    label: reconnecting ? 'paused' : forWhat,
    waiting: true,
  });

  switch (state.phase) {
    case 'ready': {
      const seats = Object.entries(state.table);
      const readyNames = seats
        .filter(([, seat]) => seat.ready)
        .map(([id]) => nameIn(room, id));
      const waitingFor = seats
        .filter(([, seat]) => !seat.ready)
        .map(([id]) => nameIn(room, id));
      const meReady = state.table[playerId]?.ready ?? false;
      return {
        label,
        kind: 'status',
        main: 'Get ready',
        meta: meReady
          ? `Waiting for ${listNames(waitingFor)}.`
          : readyNames.length > 0
            ? `${listNames(readyNames)} ${readyNames.length === 1 ? 'is' : 'are'} ready.`
            : 'Press Ready when you’re settled.',
      };
    }
    case 'countdown':
      return {
        label,
        kind: 'status',
        main: 'Hush',
        meta: `Everybody holds ${plural(state.level, 'card')}.`,
        countdown: clock('to start'),
      };
    case 'mistake': {
      const mistake = state.lastMistake;
      if (!mistake) break;
      const holders = [...new Set(mistake.discarded.map((d) => d.playerId))];
      const held = holders.map(
        (holder, index) =>
          `${nameIn(room, holder, index === 0)} still held ${cardsOf(
            mistake.discarded
              .filter((d) => d.playerId === holder)
              .map((d) => d.card),
          )}`,
      );
      return {
        label,
        kind: 'status',
        main: `${nameIn(room, mistake.playerId)} played ${mistake.card}`,
        meta: `${listNames(held)}. One life lost.`,
        countdown: clock('to go on'),
      };
    }
    case 'paused': {
      const away = awayHolders(state);
      const names = listNames(away.map((id) => nameIn(room, id)));
      return {
        label,
        kind: 'status',
        main: 'Paused',
        meta:
          away.length === 1
            ? `Waiting for ${names}, who still holds ${plural(state.table[away[0]].held, 'card')}.`
            : `Waiting for ${names}, who still hold cards.`,
        countdown: clock('seat held'),
      };
    }
    case 'cleared': {
      const last = state.lastLevel;
      return {
        label,
        kind: 'status',
        main: 'Level cleared!',
        meta: last?.lifeBack
          ? 'Not one slip: a life back.'
          : last?.livesLost === 0
            ? 'Not one slip.'
            : `It cost ${plural(last?.livesLost ?? 0, 'life', 'lives')}.`,
        countdown: clock(`to level ${state.level + 1}`),
      };
    }
    default:
      break;
  }
  return {
    label,
    kind: 'status',
    main: 'Hush',
    meta: 'Play your lowest card when it feels right.',
  };
}

/** One player's line on the scoreboard: what they hold, never a score. */
function playerLine(state: HushRoomState, seat: Seat): PlayerLine {
  const held = state.table[seat.playerId]?.held ?? 0;
  if (!seat.isConnected) {
    return {
      seat,
      status: held > 0 ? `Away, ${plural(held, 'card')}` : 'Away',
      statusIcon: 'away',
      state: 'away',
    };
  }
  if (!state.isGameStarted) return { seat, status: 'Waiting' };
  switch (state.phase) {
    case 'ready':
      return state.table[seat.playerId]?.ready
        ? { seat, status: 'Ready', statusIcon: 'check', state: 'scored' }
        : { seat, status: 'Getting ready' };
    case 'cleared':
      return {
        seat,
        status: 'Level cleared',
        statusIcon: 'check',
        state: 'scored',
      };
    case 'mistake': {
      const lost = (state.lastMistake?.discarded ?? [])
        .filter((d) => d.playerId === seat.playerId)
        .map((d) => d.card);
      if (lost.length > 0) {
        return {
          seat,
          status:
            held === 0
              ? `Lost ${cardsOf(lost)}, no cards left`
              : `Lost ${cardsOf(lost)}, ${plural(held, 'card')} left`,
          statusIcon: 'alert',
        };
      }
      break;
    }
    default:
      break;
  }
  return { seat, status: held > 0 ? plural(held, 'card') : 'No cards left' };
}
