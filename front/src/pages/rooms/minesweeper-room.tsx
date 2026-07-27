import { useNavigate, useParams } from 'react-router';
import { useEffect, useRef, useState } from 'react';
import { Modal } from 'antd';
import toast from 'react-hot-toast';
import ChatWindow from '../../components/chat-window';
import PlayerInfoContainer from '../../components/player-info-container';
import GameInfoBar from '../../components/game-info-bar';
import GameInfoBoard from '../../components/game-info-board';
import MinesweeperBoard from '../../components/minesweeper-board';
import '../../styles/pages/rooms/minesweeper-room.css';
import { useSocket } from '../../hooks/useSocket';
import type {
  MinesweeperPickResult,
  MinesweeperRoomState,
  PlayerInfo,
  RoomStatus,
} from '../../models/types';
import type { RoomErrorPayload } from '../../models/error';
import { minesweeperRoomInitialObject } from '../../data/roomInfo';
import useScreenSize from '../../hooks/useScreenSize';
import useCountdownTimer from '../../hooks/useCountDownTimer';
import { sortPlayerListByPoints } from '../../libs/utils';
import { emit, off, on } from '../../libs/socket-events';

const MinesweeperRoom = () => {
  const { socket, playerId } = useSocket();
  const navigate = useNavigate();
  const { roomId } = useParams();
  const username = sessionStorage.getItem('username');
  const [roomDoesNotExist, setRoomDoesNotExist] = useState(false);
  const { currentScreenWidth } = useScreenSize();
  const isSmallerScreen = currentScreenWidth < 1200;

  const [room, setRoom] = useState<MinesweeperRoomState>(
    minesweeperRoomInitialObject,
  );
  const roomRef = useRef(room);
  const hasAskedToJoinRef = useRef(false);

  /**
   * The cell this client committed to this round.
   *
   * Kept locally because the server deliberately never says which cell anybody
   * picked — publishing that would let a late chooser follow the crowd, which
   * is the whole point of picking simultaneously. So this is the one piece of
   * room state only its owner can know, and it is cleared when a round opens.
   */
  const [myPick, setMyPick] = useState<number | null>(null);
  /** True between rounds, while the last outcome is on screen. */
  const [isRevealing, setIsRevealing] = useState(false);

  const [phaseDeadline, setPhaseDeadline] = useState(0);
  const secondsRemaining = useCountdownTimer(phaseDeadline);

  const isRoomOwner = room.owner.playerId === playerId;
  const hasPicked = myPick !== null;
  const canPick = room.isGameStarted && !isRevealing && !hasPicked;

  const anchorPhaseDeadline = (phaseEndsInMs: number | undefined) => {
    setPhaseDeadline(
      phaseEndsInMs && phaseEndsInMs > 0 ? Date.now() + phaseEndsInMs : 0,
    );
  };

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    const askForASeat = (targetRoomId: string) => {
      if (hasAskedToJoinRef.current) return;
      hasAskedToJoinRef.current = true;
      emit(socket, 'room:join', targetRoomId, username);
    };

    on(socket, 'room:state', (state: MinesweeperRoomState) => {
      setRoom((previous) => ({ ...previous, ...state }));
      anchorPhaseDeadline(state.phaseEndsInMs);

      // Arriving mid-round: the server says who has locked in, so a reload
      // knows whether this client still owes a pick even though it cannot be
      // told which cell it chose.
      if (playerId && state.lockedIn.includes(playerId)) {
        setMyPick((current) => current ?? -1);
      }

      if (playerId && !state.playerList[playerId]) {
        askForASeat(state.roomId);
      }
    });

    on(socket, 'room:join:denied', (data: { message: string }) => {
      toast.error(data.message);
      navigate('/Gamehub/Minesweeper/Lobby', { replace: true });
    });

    on(socket, 'room:error', (roomError: RoomErrorPayload) => {
      if (roomError.errorType === 'roomNotExist') setRoomDoesNotExist(true);
      if (roomError.errorType === 'notRoomMember' && roomId) {
        askForASeat(roomId);
      }
      if (
        roomError.errorType === 'notEnoughPlayers' ||
        roomError.errorType === 'notRoomOwner'
      ) {
        toast.error(roomError.message);
      }
    });

    on(
      socket,
      'ms:game:started',
      (data: {
        playerList: Record<string, PlayerInfo>;
        isGameStarted: boolean;
        status: RoomStatus;
      }) => {
        setRoom((previous) => ({
          ...previous,
          playerList: data.playerList,
          isGameStarted: data.isGameStarted,
          status: data.status,
          lastRound: [],
        }));
      },
    );

    on(
      socket,
      'ms:round',
      (data: {
        round: number;
        board: number[];
        minesFound: number;
        lockedIn: string[];
        phaseEndsInMs: number;
      }) => {
        setRoom((previous) => ({
          ...previous,
          round: data.round,
          board: data.board,
          minesFound: data.minesFound,
          lockedIn: data.lockedIn,
        }));
        setMyPick(null);
        setIsRevealing(false);
        anchorPhaseDeadline(data.phaseEndsInMs);
      },
    );

    on(socket, 'ms:locked', (data: { lockedIn: string[] }) => {
      setRoom((previous) => ({ ...previous, lockedIn: data.lockedIn }));
    });

    on(
      socket,
      'ms:resolve',
      (data: {
        results: MinesweeperPickResult[];
        board: number[];
        playerList: Record<string, PlayerInfo>;
        minesFound: number;
        phaseEndsInMs: number;
      }) => {
        setRoom((previous) => ({
          ...previous,
          board: data.board,
          playerList: data.playerList,
          minesFound: data.minesFound,
          lastRound: data.results,
          lockedIn: [],
        }));
        setIsRevealing(true);
        anchorPhaseDeadline(data.phaseEndsInMs);
      },
    );

    on(socket, 'ms:game:ended', (state: MinesweeperRoomState) => {
      setRoom((previous) => ({ ...previous, ...state }));
      setMyPick(null);
      setIsRevealing(false);
      anchorPhaseDeadline(0);
    });

    return () => {
      off(socket, 'room:state');
      off(socket, 'room:join:denied');
      off(socket, 'room:error');
      off(socket, 'ms:game:started');
      off(socket, 'ms:round');
      off(socket, 'ms:locked');
      off(socket, 'ms:resolve');
      off(socket, 'ms:game:ended');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // Declared after the listeners, so by the time the server hears this we are
  // ready for the reply. Asked again on every reconnect, because socket.io
  // reopens a dropped connection without reloading the page.
  useEffect(() => {
    if (!roomId) return;

    const askForState = () => emit(socket, 'room:sync', roomId);
    socket.on('connect', askForState);
    if (socket.connected) askForState();

    return () => {
      socket.off('connect', askForState);
    };
  }, [socket, roomId]);

  useEffect(() => {
    return () => {
      if (roomRef.current.roomId !== '') {
        emit(socket, 'room:leave', roomRef.current.roomId, username);
      }
    };
  }, [socket, username]);

  const handleOnLeave = () => navigate('/Gamehub/Minesweeper/Lobby');
  const handleStartGame = () => emit(socket, 'game:start', room.roomId);

  const handlePick = (index: number) => {
    if (!canPick) return;
    setMyPick(index);
    emit(socket, 'ms:pick', room.roomId, index);
  };

  const myResult = room.lastRound.find(
    (result) => result.playerId === playerId,
  );

  const renderStatus = () => {
    if (!room.isGameStarted) {
      return <span className="game-info-status">Waiting for players...</span>;
    }

    if (isRevealing) {
      if (!myResult) {
        return <span className="game-info-status">Round over</span>;
      }
      return (
        <span className="game-info-status">
          {myResult.hitMine ? '💥 You hit a mine' : '✅ Safe'} —{' '}
          <b>{Math.round(myResult.risk * 100)}% risk</b>,{' '}
          <b className={myResult.points >= 0 ? 'ms-gain' : 'ms-loss'}>
            {myResult.points >= 0 ? '+' : ''}
            {myResult.points}
          </b>
        </span>
      );
    }

    if (hasPicked) {
      return (
        <span className="game-info-status">
          Locked in — waiting for{' '}
          {room.currentPlayerCount - room.lockedIn.length} more
        </span>
      );
    }

    return (
      <>
        <span className="game-info-action-indicator">Pick</span>
        <span className="game-info-status">a cell you think is safe</span>
      </>
    );
  };

  const renderSidebars = () => (
    <>
      <div className="minesweeper-room-body-left">
        {sortPlayerListByPoints(room.playerList).map(
          ([listedPlayerId, playerInfo], index) => (
            <PlayerInfoContainer
              key={listedPlayerId}
              playerInfo={playerInfo}
              isClient={listedPlayerId === playerId}
              isCurrentPlayerRoomOwner={listedPlayerId === room.owner.playerId}
              isCurrentPlayerDrawer={room.lockedIn.includes(listedPlayerId)}
              ranking={index + 1}
              isDrawingPhase={false}
              activeIcon="🔒"
            />
          ),
        )}
      </div>

      <div className="minesweeper-room-body-right">
        <GameInfoBoard
          items={[
            { label: 'Name', value: room.roomName },
            { label: 'Owner', value: room.owner.username },
            { label: 'Status', value: room.status },
            {
              label: 'Players',
              value: `${room.currentPlayerCount}/${room.maxPlayers}`,
            },
            { label: 'Board', value: room.difficulty },
            {
              label: 'Mines left',
              value: `${room.totalMines - room.minesFound} / ${room.totalMines}`,
            },
          ]}
        />
        <ChatWindow
          username={username}
          roomId={room.roomId}
          isDrawer={false}
          isDrawingPhase={false}
          receivedPointsThisTurn={false}
        />
      </div>
    </>
  );

  if (roomDoesNotExist) {
    return (
      <Modal
        title="The room you are looking for does not exist."
        open
        onOk={handleOnLeave}
      >
        Click OK to be redirected to the lobby.
      </Modal>
    );
  }

  return (
    <div className="minesweeper-room-layout">
      <GameInfoBar
        currentRound={room.round}
        handleOnLeave={handleOnLeave}
        secondsRemaining={secondsRemaining}
      >
        {renderStatus()}
      </GameInfoBar>

      <div className="minesweeper-room-body">
        <div className="minesweeper-room-body-center">
          <MinesweeperBoard
            width={room.width}
            height={room.height}
            board={room.board}
            myPick={myPick}
            canPick={canPick}
            isGameStarted={room.isGameStarted}
            isRoomOwner={isRoomOwner}
            isRevealing={isRevealing}
            lastRound={room.lastRound}
            onPick={handlePick}
            onStart={handleStartGame}
          />

          {isRevealing && room.lastRound.length > 0 && (
            <div className="minesweeper-round-summary">
              {room.lastRound
                .toSorted((a, b) => b.points - a.points)
                .map((result) => (
                  <div
                    className="minesweeper-round-summary-row"
                    key={result.playerId}
                  >
                    <span className="minesweeper-round-summary-name">
                      {result.hitMine ? '💥' : '✅'} {result.username}
                      {result.autoPlayed && ' (timed out)'}
                      {result.sharedWith > 1 && ` ×${result.sharedWith}`}
                    </span>
                    <span className="minesweeper-round-summary-risk">
                      {Math.round(result.risk * 100)}% risk
                    </span>
                    <span
                      className={result.points >= 0 ? 'ms-gain' : 'ms-loss'}
                    >
                      {result.points >= 0 ? '+' : ''}
                      {result.points}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {isSmallerScreen ? (
          <div className="side-by-side-wrapper-when-smaller-screen">
            {renderSidebars()}
          </div>
        ) : (
          renderSidebars()
        )}
      </div>
    </div>
  );
};

export default MinesweeperRoom;
