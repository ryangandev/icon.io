import {
  Die,
  HushCard,
  LetterTile,
  Lives,
  MineCell,
  NumberCard,
  PairsCard,
  PickMarker,
  symbolNamed,
  Tag,
  TriosCard,
} from '../ui';
import { cx } from '../ui/cx';
import { PHONE, useMediaQuery } from '../shell/use-media-query';
import {
  turtle,
  TURTLE_SIZE,
  type DrawingPart,
} from '../ui/generated/drawings';
import type { GameType } from '../../../shared/wire-types';
import styles from './artwork.module.css';

/** The paper panel on a game card that shows what the game looks like. */
export function GameArtwork({ type }: { type: GameType }) {
  return (
    <div className={styles.artwork} aria-hidden="true">
      {type === 'draw-and-guess' ? (
        <DrawingArtwork />
      ) : type === 'minesweeper' ? (
        <BoardArtwork />
      ) : type === 'make-24' ? (
        <HandArtwork />
      ) : type === 'liars-dice' ? (
        <DiceArtwork />
      ) : type === 'pairs' ? (
        <PairsArtwork />
      ) : type === 'trios' ? (
        <TriosArtwork />
      ) : type === 'hush' ? (
        <PileArtwork />
      ) : (
        <WordArtwork />
      )}
    </div>
  );
}

/** The finished turtle at a third of its size, and the word it was. */
function DrawingArtwork() {
  return (
    <>
      <TurtleDrawing className={styles.turtle} />
      <Tag tone="lime" icon="check">
        turtle
      </Tag>
    </>
  );
}

export function TurtleDrawing({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${TURTLE_SIZE.width} ${TURTLE_SIZE.height}`}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {turtle.Done.map((part: DrawingPart, index) =>
        'ellipse' in part ? (
          <ellipse
            key={index}
            cx={part.x + part.w / 2}
            cy={part.y + part.h / 2}
            rx={part.w / 2}
            ry={part.h / 2}
            fill={part.fill}
          />
        ) : (
          <path
            key={index}
            d={part.d}
            transform={`translate(${part.x} ${part.y})`}
            stroke={part.stroke}
            strokeWidth={part.width}
          />
        ),
      )}
    </svg>
  );
}

/** A hand, and what it makes. */
function HandArtwork() {
  return (
    <div className={styles.hand}>
      {[8, 4, 7, 1].map((value) => (
        <NumberCard key={value} value={String(value)} size="compact" />
      ))}
      <span className={styles.answer}>
        <NumberCard value="24" state="solved" size="compact" />
      </span>
    </div>
  );
}

/** A row of a board mid-game: a pair just found, one matched before. */
function PairsArtwork() {
  // The phone card's cards are compact, and it drops the last, as in Figma.
  const phone = useMediaQuery(PHONE);
  const size = phone ? 'compact' : 'regular';
  const star = symbolNamed('Star Orange');
  const circle = symbolNamed('Circle Coral');
  return (
    <div className={styles.pairs}>
      <PairsCard state={{ kind: 'down' }} size={size} row={0} column={0} />
      <PairsCard
        state={{ kind: 'up', symbol: star }}
        size={size}
        row={0}
        column={1}
      />
      <PairsCard
        state={{ kind: 'up', symbol: star }}
        size={size}
        row={0}
        column={2}
      />
      <PairsCard
        state={{ kind: 'matched', symbol: circle }}
        size={size}
        row={0}
        column={3}
      />
      {!phone && (
        <PairsCard state={{ kind: 'down' }} size={size} row={0} column={4} />
      )}
    </div>
  );
}

/**
 * A table at a call: the dice that count towards five 5s, a wild one among
 * them, one that does not, and cups still hidden. A phone keeps the first four.
 */
function DiceArtwork() {
  return (
    <div className={styles.dice}>
      <Die face="hidden" label={null} />
      <Die face={5} state="counted" label={null} />
      <Die face={1} state="wild" label={null} />
      <Die face={5} state="counted" label={null} />
      <span className={styles.lastCell}>
        <Die face={2} state="dim" label={null} />
      </span>
      <span className={styles.lastCell}>
        <Die face="hidden" label={null} />
      </span>
    </div>
  );
}

/** A strip of a board mid-game: numbers, a safe pick, a mine. */
function BoardArtwork() {
  return (
    <div className={styles.cells}>
      <MineCell state={{ kind: 'open', adjacent: 1 }} row={0} column={0} />
      <MineCell state={{ kind: 'hidden' }} row={0} column={1} />
      <MineCell
        state={{ kind: 'open', adjacent: 2 }}
        row={0}
        column={2}
        marker={<PickMarker outcome="safe" initials="SA" />}
      />
      <MineCell state={{ kind: 'mine' }} row={0} column={3} />
      <MineCell state={{ kind: 'hidden' }} row={0} column={4} />
      <span className={styles.lastCell}>
        <MineCell state={{ kind: 'open', adjacent: 1 }} row={0} column={5} />
      </span>
    </div>
  );
}

/** A card that is not in it, and a trio found: every feature different. */
function TriosArtwork() {
  // A phone's narrower card shows only the trio, as mini cards.
  const phone = useMediaQuery(PHONE);
  const size = phone ? 'mini' : 'compact';
  return (
    <div className={styles.trios}>
      {!phone && <TriosCard card={37} size={size} />}
      {[0, 40, 80].map((card) => (
        <TriosCard key={card} card={card} state="found" size={size} />
      ))}
    </div>
  );
}

/**
 * A pile mid-level: three cards played, the top one, and two lives left. A
 * phone keeps the pile's top three, as MO03 draws it.
 */
function PileArtwork() {
  return (
    <div className={styles.pile}>
      {[12, 27, 45].map((value, index) => (
        <HushCard
          key={value}
          value={value}
          state="played"
          size="small"
          className={index === 0 ? styles.wideOnly : undefined}
        />
      ))}
      <HushCard value={58} state="pile" size="small" />
      <Lives
        lives={2}
        showLabel={false}
        className={cx(styles.lives, styles.wideOnly)}
      />
    </div>
  );
}

/** A guess against PLANT: two letters elsewhere, one in place, two not in it.
    The phone card keeps the first three, as MO03 does. */
function WordArtwork() {
  const marks = ['present', 'absent', 'correct', 'absent', 'present'] as const;
  const tiles = [...'TRAIL'].map((letter, index) => (
    <LetterTile
      key={index}
      letter={letter}
      state={marks[index]}
      size="regular"
    />
  ));
  return (
    <div className={styles.word}>
      {tiles.slice(0, 3)}
      <span className={styles.wordTail}>{tiles.slice(3)}</span>
    </div>
  );
}
