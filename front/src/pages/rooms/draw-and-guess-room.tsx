import { useNavigate, useParams } from 'react-router';
import { useEffect, useRef, useState } from 'react';
import WhiteBoardCanvas from '../../components/whiteboard-canvas';
import ChatWindow from '../../components/chat-window';
import PlayerInfoContainer from '../../components/player-info-container';
import GameInfoBar from '../../components/game-info-bar';
import { Modal } from 'antd';
import '../../styles/pages/rooms/draw-and-guess-room.css';
import { useSocket } from '../../hooks/useSocket';
import type {
  DrawAndGuessRoomState,
  DrawAndGuessRoomView,
  PlayerInfo,
  RoomStatus,
  WordCategory,
} from '../../models/types';
import GameInfoBoard from '../../components/game-info-board';
import type { RoomErrorPayload } from '../../models/error';
import toast from 'react-hot-toast';
import { roomInfoInitialObject } from '../../data/roomInfo';
import useScreenSize from '../../hooks/useScreenSize';
import useCountdownTimer from '../../hooks/useCountDownTimer';
import { sortPlayerListByPoints } from '../../libs/utils';
import { emit, off, on } from '../../libs/socket-events';

const DrawAndGuessRoom = () => {
  const { socket, playerId } = useSocket();
  const navigate = useNavigate();
  const { roomId } = useParams();
  const username = sessionStorage.getItem('username');
  const [roomDoesNotExist, setRoomDoesNotExist] = useState<boolean>(false);
  const { currentScreenWidth } = useScreenSize();
  const isSmallerScreen = currentScreenWidth < 1200;

  // Room info attributes
  const [currentRoomInfo, setCurrentRoomInfo] = useState<DrawAndGuessRoomView>(
    roomInfoInitialObject,
  );
  const currentRoomInfoRef = useRef(currentRoomInfo); // Use ref to store currentRoomInfo to avoid stale closure during useEffect
  // A refresh or a pasted link reaches this page with a socket that has never
  // joined the room — the lobby does the joining, and neither of those routes
  // goes through it. Asking once is enough; a second snapshot must not send
  // another request while the first is still in flight.
  const hasAskedToJoinRef = useRef(false);
  const isDrawer = currentRoomInfo.currentDrawer === playerId;
  const isRoomOwner = currentRoomInfo.owner.playerId === playerId;
  const currentDrawerUsername =
    currentRoomInfo.playerList[currentRoomInfo.currentDrawer]?.username;
  // Empty until the identity handshake completes, so guard the lookup.
  const receivedPointsThisTurn = playerId
    ? currentRoomInfo.scoredThisTurn.includes(playerId)
    : false;

  // The clock lives on the server. Only one phase runs at a time, so the room
  // needs a single deadline: each phase event says how long is left, and we
  // anchor that against this client's own clock.
  const [phaseDeadline, setPhaseDeadline] = useState<number>(0);
  const secondsRemaining = useCountdownTimer(phaseDeadline);

  const anchorPhaseDeadline = (phaseEndsInMs: number | undefined) => {
    setPhaseDeadline(
      phaseEndsInMs && phaseEndsInMs > 0 ? Date.now() + phaseEndsInMs : 0,
    );
  };

  useEffect(() => {
    currentRoomInfoRef.current = currentRoomInfo;
  }, [currentRoomInfo]);

  useEffect(() => {
    // Reaching a room some way other than the lobby — a pasted link, a
    // bookmark — means this socket holds no seat in it. Ask for one rather
    // than sitting here as a spectator who cannot chat, guess or be dealt a
    // turn. A locked room answers with a rejection, handled below.
    const askForASeat = (targetRoomId: string) => {
      if (hasAskedToJoinRef.current) return;
      hasAskedToJoinRef.current = true;
      emit(socket, 'room:join', targetRoomId, username);
    };

    // Joining, leaving and re-syncing all deliver the same snapshot, and used
    // to do it under three different names.
    on(socket, 'room:state', (roomState: DrawAndGuessRoomState) => {
      setCurrentRoomInfo((prevRoomInfo) => ({
        ...prevRoomInfo,
        ...roomState,
      }));
      // Room snapshots carry the live phase clock, so joining or
      // watching someone leave re-syncs the countdown.
      anchorPhaseDeadline(roomState.phaseEndsInMs);

      if (playerId && !roomState.playerList[playerId]) {
        askForASeat(roomState.roomId);
      }
    });

    // Only reachable by the rejoin above: the lobby handles its own
    // rejections. A locked room cannot be rejoined without the password,
    // and the lobby is where that gets asked for.
    on(socket, 'room:join:denied', (data: { message: string }) => {
      toast.error(data.message);
      navigate('/Gamehub/DrawAndGuess/Lobby', { replace: true });
    });

    on(socket, 'room:error', (roomError: RoomErrorPayload) => {
      if (roomError.errorType === 'roomNotExist') {
        setRoomDoesNotExist(true);
      }
      // Not a failure: the state request is answered only for players who
      // hold a seat, and this is how a client that arrived by link finds
      // out it needs to ask for one.
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
      'dg:game:started',
      (data: {
        playerList: Record<string, PlayerInfo>;
        isGameStarted: boolean;
        status: RoomStatus;
        wordCategory: WordCategory;
      }) => {
        setCurrentRoomInfo((prevRoomInfo) => ({
          ...prevRoomInfo,
          playerList: data.playerList,
          isGameStarted: data.isGameStarted,
          status: data.status,
          wordCategory: data.wordCategory,
        }));
      },
    );

    on(
      socket,
      'dg:round',
      (data: { currentRound: number; drawerQueue: string[] }) => {
        setCurrentRoomInfo((prevRoomInfo) => ({
          ...prevRoomInfo,
          currentRound: data.currentRound,
          drawerQueue: data.drawerQueue,
        }));
      },
    );

    on(
      socket,
      'dg:phase:word-select',
      (data: {
        playerList: Record<string, PlayerInfo>;
        currentDrawer: string;
        drawerQueue: string[];
        scoredThisTurn: string[];
        isWordSelectingPhase: boolean;
        phaseEndsInMs: number;
      }) => {
        setCurrentRoomInfo((prevRoomInfo) => ({
          ...prevRoomInfo,
          playerList: data.playerList,
          currentDrawer: data.currentDrawer,
          drawerQueue: data.drawerQueue,
          scoredThisTurn: data.scoredThisTurn,
          isWordSelectingPhase: data.isWordSelectingPhase,
          currentWord: '',
        }));
        anchorPhaseDeadline(data.phaseEndsInMs);
      },
    );

    // ONLY drawer of the current round will receive this event.
    // If they never pick, the server falls back to the first choice — that
    // deadline used to live here, in the drawer's own browser.
    on(socket, 'dg:word-choices', (wordChoices: string[]) => {
      setCurrentRoomInfo((prevRoomInfo) => ({
        ...prevRoomInfo,
        wordChoices: wordChoices,
      }));
    });

    on(
      socket,
      'dg:phase:drawing',
      (data: {
        currentWordHint: string;
        isWordSelectingPhase: boolean;
        isDrawingPhase: boolean;
        wordChoices: string[];
        phaseEndsInMs: number;
      }) => {
        setCurrentRoomInfo((prevRoomInfo) => ({
          ...prevRoomInfo,
          currentWordHint: data.currentWordHint,
          isWordSelectingPhase: data.isWordSelectingPhase,
          isDrawingPhase: data.isDrawingPhase,
          wordChoices: data.wordChoices,
        }));
        anchorPhaseDeadline(data.phaseEndsInMs);
      },
    );

    // The hint gets easier as the drawing clock runs down: the server
    // uncovers letters on its own schedule and says what it uncovered.
    on(socket, 'dg:hint', (data: { currentWordHint: string }) => {
      setCurrentRoomInfo((prevRoomInfo) => ({
        ...prevRoomInfo,
        currentWordHint: data.currentWordHint,
      }));
    });

    // ONLY drawer of the current round will receive this event
    on(socket, 'dg:word', (word: string) => {
      setCurrentRoomInfo((prevRoomInfo) => ({
        ...prevRoomInfo,
        currentWord: word,
      }));
    });

    on(
      socket,
      'dg:scores',
      (data: {
        playerList: Record<string, PlayerInfo>;
        scoredThisTurn: string[];
      }) => {
        setCurrentRoomInfo((prevRoomInfo) => ({
          ...prevRoomInfo,
          playerList: data.playerList,
          scoredThisTurn: data.scoredThisTurn,
        }));
      },
    );

    on(
      socket,
      'dg:phase:review',
      (data: {
        isDrawingPhase: boolean;
        isReviewingPhase: boolean;
        currentWord: string;
        phaseEndsInMs: number;
      }) => {
        setCurrentRoomInfo((prevRoomInfo) => ({
          ...prevRoomInfo,
          isDrawingPhase: data.isDrawingPhase,
          isReviewingPhase: data.isReviewingPhase,
          currentWord: data.currentWord,
        }));
        anchorPhaseDeadline(data.phaseEndsInMs);
      },
    );

    on(
      socket,
      'dg:phase:idle',
      (data: {
        isWordSelectingPhase: boolean;
        isDrawingPhase: boolean;
        isReviewingPhase: boolean;
        currentDrawer: string;
        currentWord: string;
        currentWordHint: string;
      }) => {
        setCurrentRoomInfo((prevRoomInfo) => ({
          ...prevRoomInfo,
          isWordSelectingPhase: data.isWordSelectingPhase,
          isDrawingPhase: data.isDrawingPhase,
          isReviewingPhase: data.isReviewingPhase,
          currentDrawer: data.currentDrawer,
          currentWord: data.currentWord,
          currentWordHint: data.currentWordHint,
          wordChoices: [],
        }));
        anchorPhaseDeadline(0);
      },
    );

    on(socket, 'dg:game:ended', (roomState: DrawAndGuessRoomState) => {
      setCurrentRoomInfo((prevRoomInfo) => ({
        ...prevRoomInfo,
        ...roomState,
      }));
      anchorPhaseDeadline(0);
    });

    return () => {
      off(socket, 'room:state');
      off(socket, 'room:join:denied');
      off(socket, 'room:error');
      off(socket, 'dg:game:started');
      off(socket, 'dg:round');
      off(socket, 'dg:phase:word-select');
      off(socket, 'dg:word-choices');
      off(socket, 'dg:phase:drawing');
      off(socket, 'dg:word');
      off(socket, 'dg:hint');
      off(socket, 'dg:scores');
      off(socket, 'dg:phase:review');
      off(socket, 'dg:phase:idle');
      off(socket, 'dg:game:ended');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // Declared after the effect that registers the listeners, so it runs after
  // them: by the time the server hears this, we are ready for the reply.
  // The join broadcast is sent while this page is still navigating, so
  // asking once mounted is what makes arriving in a room deterministic.
  //
  // Asked again on every reconnect. socket.io reopens a dropped connection by
  // itself, without reloading the page, and the reply is what carries the
  // drawing and — for the drawer — the word: both are sent to one socket, and
  // the socket that received them is gone.
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
      if (currentRoomInfoRef.current.roomId !== '') {
        emit(socket, 'room:leave', currentRoomInfoRef.current.roomId, username);
      }
    };
  }, [socket, username]);

  const handleOnLeave = () => {
    navigate('/Gamehub/DrawAndGuess/Lobby');
  };

  const handleStartGame = () => {
    emit(socket, 'game:start', currentRoomInfo.roomId);
  };

  const renderLeftAndRightBodyContent = () => {
    return (
      <>
        {/* Player Info Section */}
        <div className="draw-and-guess-room-body-left">
          {sortPlayerListByPoints(currentRoomInfo.playerList).map(
            ([listedPlayerId, playerInfo], index) => (
              <PlayerInfoContainer
                key={listedPlayerId}
                playerInfo={playerInfo}
                isClient={listedPlayerId === playerId}
                isCurrentPlayerRoomOwner={
                  listedPlayerId === currentRoomInfo.owner.playerId
                }
                isCurrentPlayerDrawer={
                  listedPlayerId === currentRoomInfo.currentDrawer
                }
                ranking={index + 1}
                isDrawingPhase={currentRoomInfo.isDrawingPhase}
              />
            ),
          )}
        </div>

        {/* Game Info & Chat Window Section */}
        <div className="draw-and-guess-room-body-right">
          <GameInfoBoard
            name={currentRoomInfo.roomName}
            owner={currentRoomInfo.owner.username}
            status={currentRoomInfo.status}
            players={
              currentRoomInfo.currentPlayerCount +
              '/' +
              currentRoomInfo.maxPlayers
            }
            rounds={currentRoomInfo.rounds}
            wordCategory={currentRoomInfo.wordCategory}
          />
          <ChatWindow
            username={username}
            roomId={currentRoomInfo.roomId}
            isDrawer={isDrawer}
            isDrawingPhase={currentRoomInfo.isDrawingPhase}
            receivedPointsThisTurn={receivedPointsThisTurn}
          />
        </div>
      </>
    );
  };

  return (
    <>
      {roomDoesNotExist ? (
        <Modal
          title="The room you are looking for does not exist."
          open={roomDoesNotExist}
          onOk={handleOnLeave}
        >
          Click OK to be redirected to the lobby.
        </Modal>
      ) : (
        <div className="draw-and-guess-room-layout">
          <GameInfoBar
            isGameStarted={currentRoomInfo.isGameStarted}
            isWordSelectingPhase={currentRoomInfo.isWordSelectingPhase}
            isDrawingPhase={currentRoomInfo.isDrawingPhase}
            isDrawer={isDrawer}
            currentRound={currentRoomInfo.currentRound}
            currentDrawer={currentDrawerUsername}
            currentWord={currentRoomInfo.currentWord}
            currentWordHint={currentRoomInfo.currentWordHint}
            receivedPointsThisTurn={receivedPointsThisTurn}
            handleOnLeave={handleOnLeave}
            secondsRemaining={secondsRemaining}
          />

          <div className="draw-and-guess-room-body">
            <div className="draw-and-guess-room-body-center">
              <WhiteBoardCanvas
                roomId={currentRoomInfo.roomId}
                isDrawer={isDrawer}
                isGameStarted={currentRoomInfo.isGameStarted}
                isWordSelectingPhase={currentRoomInfo.isWordSelectingPhase}
                isDrawingPhase={currentRoomInfo.isDrawingPhase}
                isReviewingPhase={currentRoomInfo.isReviewingPhase}
                wordChoices={currentRoomInfo.wordChoices}
                secondsRemaining={secondsRemaining}
                isRoomOwner={isRoomOwner}
                handleStartGame={handleStartGame}
                currentDrawer={currentDrawerUsername}
                currentWord={currentRoomInfo.currentWord}
              />
            </div>

            {isSmallerScreen ? (
              <div className="side-by-side-wrapper-when-smaller-screen">
                {renderLeftAndRightBodyContent()}
              </div>
            ) : (
              <>{renderLeftAndRightBodyContent()}</>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default DrawAndGuessRoom;
