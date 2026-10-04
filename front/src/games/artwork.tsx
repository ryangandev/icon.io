import { MineCell, NumberCard, PickMarker, Tag } from '../ui';
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
      ) : (
        <HandArtwork />
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
