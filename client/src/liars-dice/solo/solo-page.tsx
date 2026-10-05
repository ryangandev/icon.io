import { useEffect, useState, type FormEvent } from 'react';
import {
  DICE_PER_PLAYER,
  type DicePerPlayer,
} from '../../../../shared/liars-dice';
import {
  BidPicker,
  Button,
  ButtonLink,
  Card,
  SelectField,
  StatList,
  TurnBar,
  type TurnBarProps,
} from '../../ui';
import { gameInfo } from '../../games/catalog';
import { plural } from '../../games/plural';
import { useSession } from '../../net/session';
import { listNames, ordinal } from '../../room/players';
import { FormPage } from '../../shell/form-page';
import { SoloLayout } from '../../solo/solo-layout';
import { SoloResult } from '../../solo/solo-result';
import { useBidChoice } from '../bid-choice';
import { Table, type TableSeat } from '../table';
import { bidLine, diceWord, naming, revealBar, type Naming } from '../words';
import {
  BOT_NAMES,
  BOT_TURN_MS,
  bid,
  call,
  currentBid,
  diceOnTable,
  isBotTurn,
  MAX_BOTS,
  MIN_BOTS,
  newGame,
  nextRound,
  placeOf,
  playBot,
  YOU,
  youWon,
  type SoloGame,
  type SoloPicks,
} from './game';
import { soloRandom } from './random';
import {
  readPicks,
  readRecord,
  recordGame,
  writePicks,
  type LiarsDiceRecord,
} from './record';
import styles from './solo-page.module.css';

const BOT_COUNTS = Array.from(
  { length: MAX_BOTS - MIN_BOTS + 1 },
  (_, index) => MIN_BOTS + index,
);

/** "5 of 10 games won", or nothing before the first game. */
function recordLine(record: LiarsDiceRecord): string | null {
  if (record.games === 0) return null;
  const run = record.run > 1 ? ` You are on a run of ${record.run} wins.` : '';
  return `You have won ${record.wins} of ${plural(record.games, 'game')} here.${run}`;
}

/**
 * LD01-LD06, LD13: Liar's Dice on your own, against bots. It all runs here:
 * nothing reaches the server, and there is no name to ask for.
 */
export function LiarsDiceSolo() {
  // Each game is a fresh mount, so nothing carries over from the last.
  const [playing, setPlaying] = useState<{
    picks: SoloPicks;
    game: number;
  } | null>(null);
  if (playing === null) {
    return (
      <TablePicker
        onStart={(picks) => {
          writePicks(picks);
          setPlaying({ picks, game: 0 });
        }}
      />
    );
  }
  return (
    <SoloTable
      key={playing.game}
      picks={playing.picks}
      onPlayAgain={() => setPlaying({ ...playing, game: playing.game + 1 })}
      onChangeTable={() => setPlaying(null)}
    />
  );
}

/** LD01: how many bots, and how many dice each. */
function TablePicker({ onStart }: { onStart: (picks: SoloPicks) => void }) {
  const game = gameInfo('liars-dice');
  const { name } = useSession();
  const [picks, setPicks] = useState(readPicks);
  const description =
    recordLine(readRecord()) ??
    'Bid on the whole table, bluff a little, and call the bots’ bluffs.';
  return (
    <FormPage
      heading={{
        eyebrow: 'On your own',
        title: game.name,
        subtitle: game.solo?.summary,
      }}
      phone={{ eyebrow: game.name, subtitle: description }}
      title="Pick a table."
      description={description}
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onStart(picks);
      }}
      actions={
        <>
          <Button type="submit">Start</Button>
          <ButtonLink
            to={name ? '/games' : '/'}
            variant="secondary"
            icon="back"
          >
            Back to games
          </ButtonLink>
        </>
      }
    >
      <SelectField
        label="Bots"
        helper={`Taken from ${BOT_NAMES.slice(0, -1).join(', ')} and ${BOT_NAMES.at(-1)}.`}
        options={BOT_COUNTS.map((count) => ({
          value: count,
          label: plural(count, 'bot'),
        }))}
        value={picks.bots}
        onValueChange={(bots: number) => setPicks({ ...picks, bots })}
        name="bots"
      />
      <SelectField
        label="Dice each"
        helper={
          picks.dicePerPlayer === 3
            ? 'The quick game.'
            : 'The classic: a longer game.'
        }
        options={DICE_PER_PLAYER.map((count) => ({
          value: count,
          label: `${count} dice`,
        }))}
        value={picks.dicePerPlayer}
        onValueChange={(dicePerPlayer: DicePerPlayer) =>
          setPicks({ ...picks, dicePerPlayer })
        }
        name="dicePerPlayer"
      />
    </FormPage>
  );
}

/** Everybody at the table, as the table draws them. */
const seatsOf = (game: SoloGame, yourName: string): TableSeat[] =>
  game.seats.map((seat) => ({
    id: seat.id,
    name: seat.id === YOU ? yourName : seat.id,
    diceLeft: seat.diceLeft,
    // Your own dice always; the bots' only when a call opens the cups.
    dice: seat.id === YOU || game.reveal ? seat.dice : null,
    outInRound: seat.outInRound,
  }));

const WHO: Naming = naming(YOU, (id) => id);

/** LD02-LD06: one game, from the first roll to your last die or theirs. */
function SoloTable({
  picks,
  onPlayAgain,
  onChangeTable,
}: {
  picks: SoloPicks;
  onPlayAgain: () => void;
  onChangeTable: () => void;
}) {
  const { name } = useSession();
  const [game, setGame] = useState(() => newGame(picks, soloRandom));
  const [record, setRecord] = useState<LiarsDiceRecord | null>(null);
  const over = game.phase === 'over';

  /** Moves the game on, counting it on this device once it is over. */
  const advance = (next: SoloGame) => {
    setGame(next);
    if (next.phase === 'over' && next !== game) {
      setRecord(recordGame(youWon(next)));
    }
  };

  // A bot takes about a second over its turn, so every bid can be read.
  useEffect(() => {
    if (!isBotTurn(game)) return;
    const timer = setTimeout(() => {
      const next = playBot(game, soloRandom);
      setGame(next);
      if (next.phase === 'over') setRecord(recordGame(youWon(next)));
    }, BOT_TURN_MS);
    return () => clearTimeout(timer);
  }, [game]);

  const you = game.seats.find((seat) => seat.id === YOU)!;
  const { place, of } = placeOf(game);
  const stillIn = game.seats
    .filter((seat) => seat.diceLeft > 0)
    .map((seat) => seat.id);
  const shown = record ?? readRecord();

  return (
    <SoloLayout
      gameType="liars-dice"
      phase={
        over
          ? youWon(game)
            ? { tone: 'lime', label: 'You won' }
            : { tone: 'peach', label: 'Out' }
          : { tone: 'blue', label: `Round ${game.round}` }
      }
      stage={
        <>
          {over ? (
            <SoloResult
              title={
                youWon(game)
                  ? `You won in ${plural(game.round, 'round')}.`
                  : `Out in ${ordinal(place)} of ${of}.`
              }
              body={
                youWon(game)
                  ? `Last at the table, with ${diceWord(you.diceLeft)} left.`
                  : `${listNames(stillIn)} ${stillIn.length === 1 ? 'was' : 'were'} still in, in round ${game.round}.`
              }
              stats={[
                { label: 'Place', value: `${ordinal(place)} of ${of}` },
                { label: 'Rounds', value: String(game.round) },
                {
                  label: 'Games won',
                  value: `${shown.wins} of ${shown.games}`,
                },
              ]}
              actions={
                <>
                  <Button onClick={onPlayAgain}>Play again</Button>
                  <Button variant="secondary" onClick={onChangeTable}>
                    Change table
                  </Button>
                </>
              }
            />
          ) : (
            <TurnBar {...turnBar(game)} />
          )}
          <Table
            seats={seatsOf(game, name || 'You')}
            youId={YOU}
            dicePerPlayer={game.dicePerPlayer}
            turnId={game.turnId}
            nextId={null}
            bids={game.bids}
            reveal={game.reveal}
            who={WHO}
            countLabel={over ? 'The last call' : 'The count'}
            beside={
              game.phase === 'reveal' ? (
                <div className={styles.next}>
                  <Button onClick={() => advance(nextRound(game, soloRandom))}>
                    Next round
                  </Button>
                </div>
              ) : game.phase === 'bidding' && game.turnId === YOU ? (
                <YourMove game={game} onMove={advance} />
              ) : undefined
            }
          />
        </>
      }
      side={
        <>
          {!over && (
            <Card kind="panel" title="This game">
              <StatList
                className={styles.stats}
                stats={[
                  { label: 'Round', value: String(game.round) },
                  {
                    label: 'Dice on the table',
                    value: String(diceOnTable(game)),
                  },
                  { label: 'Your dice', value: String(you.diceLeft) },
                ]}
              />
            </Card>
          )}
          <Card kind="panel" title="On this device">
            <StatList
              className={styles.stats}
              stats={[
                {
                  label: 'Games won',
                  value:
                    shown.games === 0
                      ? 'Not yet'
                      : `${shown.wins} of ${shown.games}`,
                  tone: shown.games === 0 ? 'muted' : undefined,
                },
                {
                  label: 'Current run',
                  value:
                    shown.games === 0 ? 'Not yet' : plural(shown.run, 'win'),
                  tone:
                    shown.games === 0
                      ? 'muted'
                      : record && youWon(game)
                        ? 'green'
                        : undefined,
                },
              ]}
            />
          </Card>
        </>
      }
    />
  );
}

/** LD02: the bid picker on your turn. */
function YourMove({
  game,
  onMove,
}: {
  game: SoloGame;
  onMove: (next: SoloGame) => void;
}) {
  const latest = currentBid(game);
  const picker = useBidChoice(latest, diceOnTable(game), (raise) =>
    onMove(bid(game, YOU, raise)),
  );
  const onCall = latest ? () => onMove(call(game, YOU)) : undefined;
  if (!picker) {
    return (
      <div className={styles.next}>
        <Button variant="danger" onClick={onCall}>
          Call Liar
        </Button>
      </div>
    );
  }
  return <BidPicker {...picker} onCall={onCall} />;
}

function turnBar(game: SoloGame): TurnBarProps {
  if (game.phase === 'reveal' && game.reveal) {
    return { ...revealBar(game.reveal, WHO), kind: 'status' };
  }
  const latest = currentBid(game);
  const bidMeta = latest ? bidLine(WHO(latest.playerId), latest) : undefined;
  if (game.turnId === YOU) {
    return {
      label: 'Your turn',
      kind: 'status',
      main: latest ? 'Raise, or call Liar' : 'Open the bidding',
      meta: bidMeta ?? `${diceWord(diceOnTable(game))} on the table`,
    };
  }
  const bot = game.turnId ?? '';
  return {
    label: `${bot}’s turn`,
    kind: 'status',
    main: `${bot} is thinking`,
    meta: bidMeta ?? 'Opening the round',
  };
}
