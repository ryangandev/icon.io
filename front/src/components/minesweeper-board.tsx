import { Button, Typography } from 'antd';
import '../styles/components/minesweeper-board.css';
import type { MinesweeperPickResult } from '../models/types';

/** Matches the server's encoding: -1 hidden, 0–8 revealed, 9 a mine that was hit. */
const HIDDEN = -1;
const KNOWN_MINE = 9;

/**
 * The classic colours, which are load-bearing rather than decorative: reading a
 * board at a glance is most of the game, and the digit's colour is how anybody
 * who has played Minesweeper before already knows what it says.
 */
const NUMBER_COLOURS = [
  '',
  '#1976d2',
  '#388e3c',
  '#d32f2f',
  '#7b1fa2',
  '#ff8f00',
  '#0097a7',
  '#424242',
  '#757575',
];

interface MinesweeperBoardProps {
  width: number;
  height: number;
  board: number[];
  /** The cell this client has committed to this round, or null. */
  myPick: number | null;
  /** True while picks are open and this client has not used theirs. */
  canPick: boolean;
  isGameStarted: boolean;
  isRoomOwner: boolean;
  isRevealing: boolean;
  /** The previous round's outcome, drawn over the board during the reveal. */
  lastRound: MinesweeperPickResult[];
  onPick: (index: number) => void;
  onStart: () => void;
}

const MinesweeperBoard = ({
  width,
  height,
  board,
  myPick,
  canPick,
  isGameStarted,
  isRoomOwner,
  isRevealing,
  lastRound,
  onPick,
  onStart,
}: MinesweeperBoardProps) => {
  /**
   * Where everybody's pick landed last round, so the reveal can mark the board
   * itself rather than only listing outcomes beside it — the point of the pause
   * is seeing *where* the room went, and who walked into what.
   */
  const pickedLastRound = new Map<number, MinesweeperPickResult[]>();
  if (isRevealing) {
    for (const result of lastRound) {
      const at = pickedLastRound.get(result.index);
      if (at) at.push(result);
      else pickedLastRound.set(result.index, [result]);
    }
  }

  const renderCell = (index: number) => {
    const cell = board[index];
    const isMine = cell === KNOWN_MINE;
    const isCovered = cell === HIDDEN;
    const results = pickedLastRound.get(index);
    const isMine1 = results?.some((result) => result.hitMine);

    const classes = ['minesweeper-cell'];
    if (isCovered) classes.push('is-covered');
    if (isMine) classes.push('is-mine');
    if (myPick === index) classes.push('is-my-pick');
    if (results) classes.push(isMine1 ? 'was-hit' : 'was-safe');
    if (isCovered && canPick) classes.push('is-pickable');

    return (
      <button
        key={index}
        type="button"
        className={classes.join(' ')}
        disabled={!isCovered || !canPick}
        onClick={() => onPick(index)}
        style={
          !isCovered && !isMine
            ? { color: NUMBER_COLOURS[cell] ?? '' }
            : undefined
        }
        title={
          results
            ? results
                .map(
                  (result) =>
                    `${result.username}: ${Math.round(result.risk * 100)}% risk, ${
                      result.points >= 0 ? '+' : ''
                    }${result.points}`,
                )
                .join('\n')
            : undefined
        }
      >
        {isMine ? '💥' : cell > 0 ? cell : ''}
      </button>
    );
  };

  return (
    <div className="minesweeper-board-container">
      <div
        className="minesweeper-board"
        style={{ gridTemplateColumns: `repeat(${width}, 1fr)` }}
      >
        {Array.from({ length: width * height }, (_, index) =>
          renderCell(index),
        )}
      </div>

      {!isGameStarted && (
        <div className="minesweeper-board-overlay">
          {isRoomOwner ? (
            <>
              <Typography.Title level={4}>
                Waiting for other players to join...
              </Typography.Title>
              <Button onClick={onStart} size="large" className="startBtn">
                START
              </Button>
            </>
          ) : (
            <Typography.Title level={4}>
              Waiting for the owner to start the game...
            </Typography.Title>
          )}
        </div>
      )}
    </div>
  );
};

export default MinesweeperBoard;
