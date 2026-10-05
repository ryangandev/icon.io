// The design gallery: every Zumpo component in the states the Figma file
// draws, beside that family's Figma preview, each measured against the
// export. Development only, at /design.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import '../zumpo.css';
import {
  Avatar,
  AVATAR_TONES,
  Button,
  Card,
  ChoiceList,
  Chat,
  ChatInput,
  ChatMessage,
  Countdown,
  Dialog,
  DialogClose,
  DrawingToolbar,
  Header,
  Icon,
  MineCell,
  MobileTabs,
  Notice,
  NumberCard,
  OperatorKey,
  PairsCard,
  PairsSymbol,
  symbolName,
  PickMarker,
  PickResult,
  PlayerRow,
  RoomBar,
  RoomRow,
  Scoreboard,
  SelectField,
  StatList,
  Tag,
  TextField,
  TriosCard,
  TriosShape,
  TurnBar,
  WordChoice,
  Wordmark,
  type BrushName,
  type BrushSize,
  type GlyphName,
} from '..';
import { glyphs } from '../generated/glyphs';
import { pairsSymbols } from '../generated/pairs-symbols';
import { Specimen } from './specimen';
import styles from './gallery.module.css';

const noop = () => {};

/** Trios cards for the gallery, with how many shapes each shows. */
const TRIOS_SPECIMENS = [
  [40, 2],
  [0, 1],
  [80, 3],
  [41, 2],
] as const;

const cap = (word: string) => `${word[0].toUpperCase()}${word.slice(1)}`;

const CLOCK_CELLS =
  'Wider on purpose: DM Sans has no tabular figures, so each digit sits in a fixed cell and the clock never changes width as it ticks.';

function Family({
  name,
  file,
  note,
  children,
}: {
  name: string;
  file: string;
  note?: string;
  children: ReactNode;
}) {
  const [preview, setPreview] = useState<boolean | null>(null);
  return (
    <section className={styles.family} id={file}>
      <header className={styles.familyHead}>
        <h2 className={styles.familyName}>{name}</h2>
        {note && <p className={styles.familyNote}>{note}</p>}
      </header>
      <div className={styles.specimens}>{children}</div>
      <figure className={styles.reference}>
        {preview !== false && (
          <img
            src={`/__figma/previews/components/${file}.png`}
            alt={`${name} in Figma`}
            onLoad={() => setPreview(true)}
            onError={() => setPreview(false)}
          />
        )}
        <figcaption className={styles.referenceCaption}>
          {preview === false
            ? 'No Figma preview: run npm run design:export with previews.'
            : 'Figma, from the latest export'}
        </figcaption>
      </figure>
    </section>
  );
}

function Mismatches() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(
      () => setCount(document.querySelectorAll('[data-mismatch]').length),
      1500,
    );
    return () => window.clearTimeout(timer);
  }, []);
  if (count === null)
    return <p className={styles.summary}>Measuring against Figma…</p>;
  return (
    <p className={styles.summary}>
      {count === 0
        ? 'Every measured specimen matches its Figma size.'
        : `${count} specimen${count === 1 ? '' : 's'} differ from Figma by more than half a pixel (in red).`}
    </p>
  );
}

const PLAYERS = {
  maya: { name: 'Maya', initials: 'MA', tone: 'peach' },
  ryan: { name: 'Ryan', initials: 'RG', tone: 'blue' },
  leo: { name: 'Leo', initials: 'LE', tone: 'lime' },
  sam: { name: 'Sam', initials: 'SA', tone: 'sand' },
} as const;

/** The avatar Figma's Player row and Pick result samples use. */
const SAMPLE_AVATAR = { initials: 'RG', tone: 'peach' } as const;

export default function Gallery() {
  const [seats, setSeats] = useState(8);
  const [rounds, setRounds] = useState(2);
  const [board, setBoard] = useState<'small' | 'medium' | 'large'>('medium');
  const [choice, setChoice] = useState('medium');
  const [colour, setColour] = useState<BrushName>('ink');
  const [size, setSize] = useState<BrushSize>(10);
  const [view, setView] = useState<'board' | 'players' | 'chat'>('board');
  const [dialog, setDialog] = useState(false);
  const stay = useRef<HTMLButtonElement>(null);

  return (
    <div className={`zumpo zumpo-page ${styles.page}`}>
      <div className={styles.intro}>
        <Wordmark />
        <h1 className={styles.title}>Design system</h1>
        <p className={styles.lede}>
          The Shared pieces of the Figma file as code. Each specimen is
          captioned with its Figma variant and measured against the export; the
          family&rsquo;s Figma preview sits beside it.
        </p>
        <Mismatches />
      </div>

      <Family name="Button" file="button">
        {(['primary', 'secondary', 'quiet', 'danger'] as const).map(
          (variant) => {
            const style = variant[0].toUpperCase() + variant.slice(1);
            return [
              <Specimen
                key={variant}
                family="button"
                variant={`Style=${style}, State=Default`}
              >
                <Button variant={variant}>Let’s play</Button>
              </Specimen>,
              <Specimen
                key={`${variant}-disabled`}
                family="button"
                variant={`Style=${style}, State=Disabled`}
              >
                <Button variant={variant} disabled>
                  Let’s play
                </Button>
              </Specimen>,
            ];
          },
        )}
        <Specimen family="button" label="With icon">
          <Button variant="secondary" icon="leave">
            Leave room
          </Button>
        </Specimen>
        <Specimen family="button" label="Icon only">
          <Button variant="secondary" icon="leave" iconOnly>
            Leave room
          </Button>
        </Specimen>
      </Family>

      <Family
        name="Icon"
        file="icon"
        note="24 px line icons, 2 px strokes in currentColor."
      >
        {(Object.keys(glyphs) as GlyphName[]).map((glyph) => (
          <Specimen
            key={glyph}
            family="icon"
            variant={`Glyph=${glyph}`}
            label={glyph}
          >
            <Icon glyph={glyph} />
          </Specimen>
        ))}
      </Family>

      <Family name="Avatar" file="avatar">
        {AVATAR_TONES.map((tone) => (
          <Specimen
            key={tone}
            family="avatar"
            variant={`Tone=${tone[0].toUpperCase()}${tone.slice(1)}`}
          >
            <Avatar initials="RG" tone={tone} />
          </Specimen>
        ))}
        <Specimen family="avatar" label="Small (phone header)">
          <Avatar initials="MA" tone="peach" size="small" />
        </Specimen>
      </Family>

      <Family name="Tag" file="tag">
        {(['sand', 'blue', 'lime', 'peach', 'paper', 'ink'] as const).map(
          (tone) => (
            <Specimen
              key={tone}
              family="tag"
              variant={`Tone=${tone[0].toUpperCase()}${tone.slice(1)}`}
            >
              <Tag tone={tone}>Waiting room</Tag>
            </Specimen>
          ),
        )}
        <Specimen family="tag" label="With icon">
          <Tag tone="lime" icon="check">
            Safe
          </Tag>
        </Specimen>
        <Specimen family="tag" label="Compact">
          <Tag size="compact">You</Tag>
        </Specimen>
      </Family>

      <Family name="Notice" file="notice">
        {(['info', 'success', 'error', 'pending'] as const).map((tone) => (
          <Specimen
            key={tone}
            family="notice"
            variant={`Tone=${tone[0].toUpperCase()}${tone.slice(1)}`}
            width={560}
          >
            <Notice tone={tone}>Connection restored. Welcome back!</Notice>
          </Specimen>
        ))}
        <Specimen family="notice" label="Two lines" width={360}>
          <Notice tone="error">
            That room is full now. Pick another one, or make your own room.
          </Notice>
        </Specimen>
      </Family>

      <Family
        name="Countdown"
        file="countdown"
        note="Urgent is automatic in the last 5 seconds of a phase you act in."
      >
        <Specimen
          family="countdown"
          variant="Tone=Running"
          deviation={CLOCK_CELLS}
        >
          <Countdown seconds={15} label="to pick" />
        </Specimen>
        <Specimen
          family="countdown"
          variant="Tone=Waiting"
          deviation={CLOCK_CELLS}
        >
          <Countdown seconds={15} label="to pick" waiting />
        </Specimen>
        <Specimen
          family="countdown"
          variant="Tone=Urgent"
          deviation={CLOCK_CELLS}
        >
          <Countdown seconds={4} label="to pick" />
        </Specimen>
      </Family>

      <Family name="Input" file="input">
        <Specimen family="input" variant="State=Default" width={496}>
          <TextField
            label="Your name"
            defaultValue="Maya"
            helper="Up to 18 characters."
          />
        </Specimen>
        <Specimen family="input" variant="State=Error" width={496}>
          <TextField
            label="Your name"
            defaultValue="Maya"
            error="That name is taken in this room."
          />
        </Specimen>
        <Specimen family="input" variant="State=Disabled" width={496}>
          <TextField
            label="Your name"
            defaultValue="Maya"
            helper="Up to 18 characters."
            disabled
          />
        </Specimen>
        <Specimen family="input" label="Select: Seats" width={496}>
          <SelectField
            label="Seats"
            value={seats}
            onValueChange={setSeats}
            options={[2, 3, 4, 5, 6, 7, 8].map((n) => ({
              value: n,
              label: `${n} players`,
            }))}
            helper="Up to 8 players."
          />
        </Specimen>
        <Specimen family="input" label="Select: Rounds" width={496}>
          <SelectField
            label="Rounds"
            value={rounds}
            onValueChange={setRounds}
            options={[1, 2, 3, 4].map((n) => ({
              value: n,
              label: n === 1 ? '1 round' : `${n} rounds`,
            }))}
          />
        </Specimen>
        <Specimen family="input" label="Select: Board" width={496}>
          <SelectField
            label="Board"
            value={board}
            onValueChange={setBoard}
            options={[
              { value: 'small', label: 'Small', detail: '9 × 9 · 10 mines' },
              {
                value: 'medium',
                label: 'Medium',
                detail: '16 × 16 · 40 mines',
              },
              { value: 'large', label: 'Large', detail: '30 × 16 · 99 mines' },
            ]}
            helper={
              {
                small: '9 × 9 · 10 mines',
                medium: '16 × 16 · 40 mines',
                large: '30 × 16 · 99 mines',
              }[board]
            }
          />
        </Specimen>
      </Family>

      <Family name="Chat message" file="chat-message">
        <Specimen family="chat-message" variant="Kind=Player" width={296}>
          <ul
            style={{ margin: 0, padding: 0, listStyle: 'none', width: '100%' }}
          >
            <ChatMessage kind="player" name="Ryan">
              a turtle?
            </ChatMessage>
          </ul>
        </Specimen>
        {(['system', 'success', 'alert'] as const).map((kind) => (
          <Specimen
            key={kind}
            family="chat-message"
            variant={`Kind=${kind[0].toUpperCase()}${kind.slice(1)}`}
            width={296}
          >
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                width: '100%',
              }}
            >
              <ChatMessage kind={kind}>a turtle?</ChatMessage>
            </ul>
          </Specimen>
        ))}
        <Specimen family="chat-message" label="Wrapped" width={296}>
          <ul
            style={{ margin: 0, padding: 0, listStyle: 'none', width: '100%' }}
          >
            <ChatMessage kind="success">
              Sam guessed the word! +112 and the round is over
            </ChatMessage>
          </ul>
        </Specimen>
      </Family>

      <Family name="Chat input" file="chat-input">
        <Specimen family="chat-input" variant="State=Default" width={296}>
          <ChatInput onSend={noop} />
        </Specimen>
        <Specimen family="chat-input" variant="State=Disabled" width={296}>
          <ChatInput onSend={noop} lockedReason="Type a guess or say hi…" />
        </Specimen>
      </Family>

      <Family name="Chat" file="chat">
        <Specimen family="chat" width={344}>
          <Chat input={{ onSend: noop }}>
            <ChatMessage kind="system">
              Game has started! The category is Animals.
            </ChatMessage>
            <ChatMessage kind="player" name="Ryan">
              a rock?
            </ChatMessage>
            <ChatMessage kind="player" name="Leo">
              tortoise
            </ChatMessage>
            <ChatMessage kind="success">Sam guessed the word! +112</ChatMessage>
            <ChatMessage kind="player" name="Ryan">
              a shell with legs
            </ChatMessage>
            <ChatMessage kind="player" name="Leo">
              snail?
            </ChatMessage>
          </Chat>
        </Specimen>
      </Family>

      <Family name="Player row" file="player-row">
        {(['default', 'highlight', 'scored', 'away'] as const).map((state) => (
          <Specimen
            key={state}
            family="player-row"
            variant={`State=${state[0].toUpperCase()}${state.slice(1)}`}
            width={312}
          >
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                width: '100%',
              }}
            >
              <PlayerRow
                {...PLAYERS.maya}
                {...SAMPLE_AVATAR}
                status="Drawing"
                statusIcon="brush"
                score={460}
                state={state}
              />
            </ul>
          </Specimen>
        ))}
        <Specimen family="player-row" label="Host and you" width={312}>
          <ul
            style={{ margin: 0, padding: 0, listStyle: 'none', width: '100%' }}
          >
            <PlayerRow {...PLAYERS.sam} status="Waiting" score={180} host you />
          </ul>
        </Specimen>
      </Family>

      <Family name="Scoreboard" file="scoreboard">
        <Specimen family="scoreboard" width={344}>
          <Scoreboard players={4} seats={8}>
            <PlayerRow
              {...PLAYERS.maya}
              status="Drawing"
              statusIcon="brush"
              score={460}
              host
              state="highlight"
            />
            <PlayerRow {...PLAYERS.ryan} status="Guessing" score={320} />
            <PlayerRow {...PLAYERS.leo} status="Guessing" score={240} />
            <PlayerRow {...PLAYERS.sam} status="Guessing" score={180} you />
          </Scoreboard>
        </Specimen>
      </Family>

      <Family name="Room row" file="room-row">
        {(['open', 'private', 'full', 'playing'] as const).map((status) => (
          <Specimen
            key={status}
            family="room-row"
            variant={`Status=${status[0].toUpperCase()}${status.slice(1)}, Layout=Desktop`}
            width={840}
          >
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                width: '100%',
              }}
            >
              <RoomRow
                name="Maya’s room"
                details="Hosted by Maya · 3 rounds"
                host={PLAYERS.maya}
                players={status === 'full' ? 8 : 4}
                seats={8}
                status={status}
                onJoin={noop}
              />
            </ul>
          </Specimen>
        ))}
        <Specimen
          family="room-row"
          variant="Status=Open, Layout=Phone"
          width={350}
        >
          <ul
            style={{ margin: 0, padding: 0, listStyle: 'none', width: '100%' }}
          >
            <RoomRow
              name="Maya’s room"
              details="Hosted by Maya · 3 rounds"
              host={PLAYERS.maya}
              players={4}
              seats={8}
              status="open"
              onJoin={noop}
            />
          </ul>
        </Specimen>
      </Family>

      <Family name="Turn bar" file="turn-bar">
        <Specimen
          family="turn-bar"
          variant="Kind=Word, Layout=Desktop"
          width={944}
        >
          <TurnBar
            category="Animals"
            label="Guess the word"
            kind="word"
            main="__r___"
            meta="6 letters"
            countdown={{ seconds: 72, label: 'left' }}
          />
        </Specimen>
        <Specimen
          family="turn-bar"
          variant="Kind=Hint, Layout=Desktop"
          width={944}
        >
          <TurnBar
            category="Animals"
            label="Guess the word"
            kind="hint"
            main="__r___"
            meta="6 letters"
            countdown={{ seconds: 58, label: 'left' }}
          />
        </Specimen>
        <Specimen
          family="turn-bar"
          variant="Kind=Status, Layout=Desktop"
          width={944}
        >
          <TurnBar
            category="Animals"
            label="Guess the word"
            kind="status"
            main="__r___"
            meta="6 letters"
            countdown={{ seconds: 12, label: 'to choose', waiting: true }}
          />
        </Specimen>
        <Specimen
          family="turn-bar"
          variant="Kind=Hint, Layout=Phone"
          width={350}
        >
          <TurnBar
            category="Animals"
            label="Guess the word"
            kind="hint"
            main="__r___"
            meta="6 letters"
            countdown={{ seconds: 58, label: 'left' }}
          />
        </Specimen>
      </Family>

      <Family name="Drawing toolbar" file="drawing-toolbar">
        <Specimen family="drawing-toolbar" variant="Layout=Desktop" width={944}>
          <DrawingToolbar
            colour={colour}
            onColourChange={setColour}
            size={size}
            onSizeChange={setSize}
            onUndo={noop}
            onClear={noop}
          />
        </Specimen>
        <Specimen family="drawing-toolbar" variant="Layout=Phone" width={358}>
          <DrawingToolbar
            colour={colour}
            onColourChange={setColour}
            size={size}
            onSizeChange={setSize}
            onUndo={noop}
            onClear={noop}
          />
        </Specimen>
      </Family>

      <Family name="Word choice" file="word-choice">
        <Specimen family="word-choice" width={260}>
          <WordChoice word="Turtle" onChoose={noop} />
        </Specimen>
      </Family>

      <Family
        name="Mine cell"
        file="mine-cell"
        note="Regular is 36 px on phones."
      >
        {(['regular', 'compact'] as const).map((cellSize) => {
          const sizeName = cellSize === 'regular' ? 'Regular' : 'Compact';
          return (
            <div
              key={cellSize}
              className={styles.cellRow}
              role="grid"
              aria-label={sizeName}
            >
              <div role="row" className={styles.cellRow}>
                <Specimen
                  family="mine-cell"
                  variant={`State=Hidden, Size=${sizeName}`}
                  label="Hidden"
                >
                  <MineCell
                    state={{ kind: 'hidden' }}
                    size={cellSize}
                    row={0}
                    column={0}
                    onPick={noop}
                  />
                </Specimen>
                <Specimen
                  family="mine-cell"
                  variant={`State=Picked, Size=${sizeName}`}
                  label="Picked"
                >
                  <MineCell
                    state={{ kind: 'picked' }}
                    size={cellSize}
                    row={0}
                    column={1}
                  />
                </Specimen>
                <Specimen
                  family="mine-cell"
                  variant={`State=Empty, Size=${sizeName}`}
                  label="Empty"
                >
                  <MineCell
                    state={{ kind: 'open', adjacent: 0 }}
                    size={cellSize}
                    row={0}
                    column={2}
                  />
                </Specimen>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <Specimen
                    key={n}
                    family="mine-cell"
                    variant={`State=${n}, Size=${sizeName}`}
                    label={String(n)}
                  >
                    <MineCell
                      state={{ kind: 'open', adjacent: n }}
                      size={cellSize}
                      row={0}
                      column={2 + n}
                    />
                  </Specimen>
                ))}
                <Specimen
                  family="mine-cell"
                  variant={`State=Mine, Size=${sizeName}`}
                  label="Mine"
                >
                  <MineCell
                    state={{ kind: 'mine' }}
                    size={cellSize}
                    row={0}
                    column={11}
                  />
                </Specimen>
                {(
                  [
                    ['Flag', 'flag'],
                    ['Hit', 'hit'],
                    ['Wrong flag', 'wrong-flag'],
                  ] as const
                ).map(([state, kind], index) => (
                  <Specimen
                    key={kind}
                    family="mine-cell"
                    variant={`State=${state}, Size=${sizeName}`}
                    label={state}
                  >
                    <MineCell
                      state={{ kind }}
                      size={cellSize}
                      row={0}
                      column={12 + index}
                    />
                  </Specimen>
                ))}
              </div>
            </div>
          );
        })}
      </Family>

      <Family
        name="Pick marker"
        file="pick-marker"
        note="Laid over a cell during the reveal."
      >
        {(['regular', 'compact'] as const).map((cellSize) =>
          (['safe', 'mine', 'auto'] as const).map((outcome) => (
            <Specimen
              key={`${cellSize}-${outcome}`}
              family="pick-marker"
              variant={`Outcome=${outcome[0].toUpperCase()}${outcome.slice(1)}, Size=${cellSize === 'regular' ? 'Regular' : 'Compact'}`}
            >
              <span
                className={
                  cellSize === 'regular'
                    ? styles.markerBox
                    : styles.markerBoxCompact
                }
              >
                <PickMarker outcome={outcome} initials="SA" size={cellSize} />
              </span>
            </Specimen>
          )),
        )}
        <div className={styles.cellRow} role="grid" aria-label="Reveal">
          <div role="row" className={styles.cellRow}>
            {(['safe', 'mine', 'auto'] as const).map((outcome, column) => (
              <Specimen key={outcome} label={`Over a cell: ${outcome}`}>
                <MineCell
                  state={
                    outcome === 'mine'
                      ? { kind: 'mine' }
                      : { kind: 'open', adjacent: 1 }
                  }
                  row={0}
                  column={column}
                  marker={<PickMarker outcome={outcome} initials="SA" />}
                />
              </Specimen>
            ))}
          </div>
        </div>
      </Family>

      <Family
        name="Number card"
        file="number-card"
        note="Values longer than two characters, such as 8/3, step down a text size."
      >
        {(['regular', 'compact'] as const).map((cardSize) => {
          const sizeName = cardSize === 'regular' ? 'Regular' : 'Compact';
          return (
            <div key={cardSize} className={styles.cellRow}>
              {(
                [
                  ['Default', 'default', '8', undefined],
                  ['Selected', 'selected', '8', undefined],
                  ['Made', 'made', '4', '8 − 4'],
                  ['Solved', 'solved', '24', '4 × 6'],
                  ['Not 24', 'not-24', '20', 'Not 24'],
                ] as const
              ).map(([state, kind, value, formula]) => (
                <Specimen
                  key={kind}
                  family="number-card"
                  variant={`State=${state}, Size=${sizeName}`}
                  label={state}
                >
                  <NumberCard
                    value={value}
                    formula={formula}
                    state={kind}
                    size={cardSize}
                  />
                </Specimen>
              ))}
              <Specimen label="A fraction">
                <NumberCard
                  value="8/3"
                  formula="8 ÷ 3"
                  state="made"
                  size={cardSize}
                />
              </Specimen>
              <Specimen label="A button">
                <NumberCard value="7" size={cardSize} label="7" onPick={noop} />
              </Specimen>
            </div>
          );
        })}
      </Family>

      <Family name="Operator key" file="operator-key">
        <Specimen family="operator-key" variant="State=Default">
          <OperatorKey symbol="×" label="times" onPick={noop} />
        </Specimen>
        <Specimen family="operator-key" variant="State=Selected">
          <OperatorKey symbol="×" label="times" selected onPick={noop} />
        </Specimen>
      </Family>

      <Family name="Pairs card" file="pairs-card">
        {(['regular', 'compact'] as const).map((cardSize) => {
          const sizeName = cardSize === 'regular' ? 'Regular' : 'Compact';
          return (
            <div
              key={cardSize}
              className={styles.cellRow}
              role="grid"
              aria-label={`Pairs ${sizeName}`}
            >
              <div role="row" className={styles.cellRow}>
                {(
                  [
                    ['Down', { kind: 'down' }],
                    ['Up', { kind: 'up', symbol: 0 }],
                    ['Matched', { kind: 'matched', symbol: 0 }],
                  ] as const
                ).map(([state, cardState]) => (
                  <Specimen
                    key={state}
                    family="pairs-card"
                    variant={`State=${state}, Size=${sizeName}`}
                    label={state}
                  >
                    <PairsCard
                      state={cardState}
                      size={cardSize}
                      row={0}
                      column={0}
                      onPick={noop}
                    />
                  </Specimen>
                ))}
              </div>
            </div>
          );
        })}
      </Family>

      <Family
        name="Pairs symbol"
        file="pairs-symbol"
        note="Nine shapes in two brush colours each; a Small board draws eight of them."
      >
        <div className={styles.cellRow}>
          {pairsSymbols.map((_, symbol) => (
            <Specimen
              key={symbol}
              family="pairs-symbol"
              variant={`Symbol=${symbolName(symbol)}`}
              label={symbolName(symbol)}
            >
              <PairsSymbol symbol={symbol} />
            </Specimen>
          ))}
        </div>
      </Family>

      <Family name="Trios card" file="trios-card">
        {(
          [
            ['regular', 'Regular', ['Default', 'Selected', 'Found', 'Wrong']],
            ['compact', 'Compact', ['Default', 'Selected', 'Found', 'Wrong']],
            ['mini', 'Mini', ['Default', 'Found']],
          ] as const
        ).map(([cardSize, sizeName, states]) => (
          <div key={cardSize} className={styles.cellRow}>
            {states.map((state, index) => {
              // Every count, colour, shape and fill appears in a row.
              const [card, count] = TRIOS_SPECIMENS[index];
              return (
                <Specimen
                  key={state}
                  family="trios-card"
                  variant={`Count=${count}, State=${state}, Size=${sizeName}`}
                  label={`${state}, ${sizeName}`}
                >
                  <TriosCard
                    card={card}
                    state={state.toLowerCase() as Lowercase<typeof state>}
                    size={cardSize}
                    badge={
                      state === 'Found' && cardSize !== 'mini'
                        ? 'MA'
                        : undefined
                    }
                  />
                </Specimen>
              );
            })}
            {cardSize !== 'mini' && (
              <Specimen label={`Hinted, ${sizeName}`}>
                <TriosCard card={62} size={cardSize} badge="Hint" />
              </Specimen>
            )}
          </div>
        ))}
      </Family>

      <Family
        name="Trios shape"
        file="trios-shape"
        note="Three shapes, three fills, three colours: 27 in all, scaled as a whole on smaller cards."
      >
        {(['circle', 'triangle', 'square'] as const).map((shape) => (
          <div key={shape} className={styles.cellRow}>
            {(['solid', 'striped', 'outline'] as const).flatMap((fill) =>
              (['coral', 'blue', 'ink'] as const).map((tone) => (
                <Specimen
                  key={`${fill}-${tone}`}
                  family="trios-shape"
                  variant={`Shape=${cap(shape)}, Fill=${cap(fill)}, Colour=${cap(tone)}`}
                  label={`${cap(tone)} ${fill}`}
                >
                  <TriosShape shape={shape} fill={fill} colour={tone} />
                </Specimen>
              )),
            )}
          </div>
        ))}
      </Family>

      <Family name="Pick result" file="pick-result">
        {(['safe', 'mine', 'auto'] as const).map((outcome) => (
          <Specimen
            key={outcome}
            family="pick-result"
            variant={`Outcome=${outcome[0].toUpperCase()}${outcome.slice(1)}`}
            width={832}
          >
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                width: '100%',
              }}
            >
              <PickResult
                {...PLAYERS.sam}
                {...SAMPLE_AVATAR}
                outcome={outcome}
                detail="23% risk"
                points={outcome === 'mine' ? -20 : 31}
              />
            </ul>
          </Specimen>
        ))}
      </Family>

      <Family name="Mobile tabs" file="mobile-tabs">
        <Specimen family="mobile-tabs" variant="View=Board" width={480}>
          <MobileTabs
            value={view}
            onValueChange={setView}
            tabs={[
              { value: 'board', label: 'Board', panel: null },
              { value: 'players', label: 'Players · 4', panel: null },
              { value: 'chat', label: 'Chat', panel: null },
            ]}
          />
        </Specimen>
      </Family>

      <Family name="Header and wordmark" file="header">
        <Specimen family="header" width={1312}>
          <Header
            links={[
              { label: 'Games', to: '/design', current: true },
              { label: 'How to play', to: '/design' },
            ]}
            viewer={{ ...PLAYERS.maya, label: 'You are Maya' }}
          />
        </Specimen>
        <Specimen family="wordmark">
          <Wordmark />
        </Specimen>
      </Family>

      <Family
        name="Room bar"
        file="room-bar"
        note="A seated room's header and heading in one row. Its only link out is the wordmark, which the room guards with the leave dialog."
      >
        <Specimen family="room-bar" variant="Layout=Desktop" width={1312}>
          <RoomBar
            game="Minesweeper"
            room="Maya’s room"
            phase={{ tone: 'blue', label: 'Round 2' }}
            onHowToPlay={noop}
            onLeave={noop}
            viewer={{ ...PLAYERS.sam, label: 'You are Sam' }}
          />
        </Specimen>
        <Specimen family="room-bar" variant="Layout=Phone" width={350}>
          <RoomBar
            layout="phone"
            game="Minesweeper"
            room="Maya’s room"
            phase={{ tone: 'blue', label: 'Round 4' }}
            onHowToPlay={noop}
            onLeave={noop}
            viewer={{ ...PLAYERS.sam, label: 'You are Sam' }}
          />
        </Specimen>
        <Specimen label="Choice list: Board, in the page" width={496}>
          <ChoiceList
            label="Board"
            value={choice}
            onValueChange={setChoice}
            options={[
              {
                value: 'small',
                label: 'Small · 9 × 9',
                detail: '10 mines. Best: 0:48',
              },
              {
                value: 'medium',
                label: 'Medium · 16 × 16',
                detail: '40 mines. Best: 3:12',
              },
              {
                value: 'large',
                label: 'Large · 30 × 16',
                detail: '99 mines. No best yet',
              },
            ]}
          />
        </Specimen>
      </Family>

      <Family
        name="Card and dialog"
        file="card"
        note="The focused card of name, create-room and password pages, the dialog over a room, and the panels of an empty or loading lobby. Figma's variants hold an empty Content slot, so the specimens are not measured; the screens that use them are."
      >
        <Specimen label="Kind=Focused" width={560}>
          <Card
            title="A little room for you."
            description="Set up your game and invite some good company."
            actions={
              <>
                <Button>Continue</Button>
                <Button variant="quiet">Cancel</Button>
              </>
            }
            onSubmit={(event) => event.preventDefault()}
          >
            <TextField
              label="Your name"
              defaultValue="Maya"
              helper="Up to 18 characters."
            />
          </Card>
        </Specimen>
        <Specimen label="Kind=Panel" width={920}>
          <Card
            kind="panel"
            title="A little quiet in here."
            description="Be the first to make a room. Bring a friend and get playing."
            actions={<Button>Create the first room</Button>}
          />
        </Specimen>
        <Specimen label="Kind=Panel: stats beside a game" width={344}>
          <Card kind="panel" title="Best on this device">
            <StatList
              className={styles.stretch}
              stats={[
                { label: 'Small · 9 × 9', value: '0:48' },
                { label: 'Medium · 16 × 16', value: '3:05', tone: 'green' },
                { label: 'Large · 30 × 16', value: 'Not yet', tone: 'muted' },
              ]}
            />
          </Card>
        </Specimen>
        <Specimen label="Kind=Dialog: opens over the page">
          <Button
            variant="secondary"
            icon="leave"
            onClick={() => setDialog(true)}
          >
            Leave room
          </Button>
        </Specimen>
        <Dialog
          open={dialog}
          onOpenChange={setDialog}
          initialFocus={stay}
          title="Leave Maya’s room?"
          description="The game carries on without you, and your seat and your 180 points go with you. You can join again while a seat is open."
          actions={
            <>
              <Button
                variant="danger"
                icon="leave"
                onClick={() => setDialog(false)}
              >
                Leave room
              </Button>
              <DialogClose
                render={
                  <Button ref={stay} variant="secondary">
                    Stay
                  </Button>
                }
              />
            </>
          }
        />
      </Family>
    </div>
  );
}
