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
    DrawAndGuessDetailRoomInfo,
    PlayerInfo,
    RoomStatus,
} from '../../models/types';
import GameInfoBoard from '../../components/game-info-board';
import type { CustomError } from '../../models/error';
import toast from 'react-hot-toast';
import { roomInfoInitialObject } from '../../data/roomInfo';
import useScreenSize from '../../hooks/useScreenSize';
import useCountdownTimer from '../../hooks/useCountDownTimer';
import { sortPlayerListByPoints } from '../../libs/utils';

const DrawAndGuessRoom = () => {
    const { socket } = useSocket();
    const navigate = useNavigate();
    const { roomId } = useParams();
    const username = sessionStorage.getItem('username');
    const [roomDoesNotExist, setRoomDoesNotExist] = useState<boolean>(false);
    const { currentScreenWidth } = useScreenSize();
    const isSmallerScreen = currentScreenWidth < 1200;

    // Room info attributes
    const [currentRoomInfo, setCurrentRoomInfo] =
        useState<DrawAndGuessDetailRoomInfo>(roomInfoInitialObject);
    const currentRoomInfoRef = useRef(currentRoomInfo); // Use ref to store currentRoomInfo to avoid stale closure during useEffect
    // A refresh or a pasted link reaches this page with a socket that has never
    // joined the room — the lobby does the joining, and neither of those routes
    // goes through it. Asking once is enough; a second snapshot must not send
    // another request while the first is still in flight.
    const hasAskedToJoinRef = useRef(false);
    const isDrawer = currentRoomInfo.currentDrawer === socket.id;
    const isRoomOwner = currentRoomInfo.owner.socketId === socket.id;
    const currentDrawerUsername =
        currentRoomInfo.playerList[currentRoomInfo.currentDrawer]?.username;
    // socket.id is undefined until the socket has connected, so guard the lookup.
    const receivedPointsThisTurn = socket.id
        ? (currentRoomInfo.playerList[socket.id]?.receivedPointsThisTurn ??
          false)
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
        socket.on(
            'clientJoinDrawAndGuessRoomSuccess',
            (currentRoomInfo: DrawAndGuessDetailRoomInfo) => {
                setCurrentRoomInfo((prevRoomInfo) => ({
                    ...prevRoomInfo,
                    ...currentRoomInfo,
                }));
                // Room snapshots carry the live phase clock, so joining or
                // watching someone leave re-syncs the countdown.
                anchorPhaseDeadline(currentRoomInfo.phaseEndsInMs);

                // Arriving without being in the player list means this socket
                // reached the room some way other than the lobby. Ask to join
                // rather than sitting here as a spectator who cannot chat,
                // guess or be dealt a turn.
                if (
                    !hasAskedToJoinRef.current &&
                    socket.id &&
                    !currentRoomInfo.playerList[socket.id]
                ) {
                    hasAskedToJoinRef.current = true;
                    socket.emit(
                        'clientJoinDrawAndGuessRoomRequest',
                        currentRoomInfo.roomId,
                        username,
                    );
                }
            },
        );

        // Only reachable by the rejoin above: the lobby handles its own
        // rejections. A locked room cannot be rejoined without the password,
        // and the lobby is where that gets asked for.
        socket.on(
            'rejectClientJoinDrawAndGuessRoomRequest',
            (data: { message: string }) => {
                toast.error(data.message);
                navigate('/Gamehub/DrawAndGuess/Lobby', { replace: true });
            },
        );

        socket.on(
            'clientLeaveDrawAndGuessRoomSuccess',
            (currentRoomInfo: DrawAndGuessDetailRoomInfo) => {
                setCurrentRoomInfo((prevRoomInfo) => ({
                    ...prevRoomInfo,
                    ...currentRoomInfo,
                }));
                anchorPhaseDeadline(currentRoomInfo.phaseEndsInMs);
            },
        );

        socket.on('roomError', (roomError: CustomError) => {
            console.log('roomError received: ', roomError);
            if (roomError.errorType === 'roomNotExist') {
                setRoomDoesNotExist(true);
            }
            if (roomError.errorType === 'notEnoughPlayers') {
                toast.error(roomError.message);
            }
        });

        socket.on(
            'startDrawAndGuessGameSuccess',
            (data: {
                playerList: Record<string, PlayerInfo>;
                isGameStarted: boolean;
                status: RoomStatus;
                wordCategory: string;
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

        socket.on(
            'startNewRoundSuccess',
            (data: { currentRound: number; drawerQueue: string[] }) => {
                setCurrentRoomInfo((prevRoomInfo) => ({
                    ...prevRoomInfo,
                    currentRound: data.currentRound,
                    drawerQueue: data.drawerQueue,
                }));
            },
        );

        socket.on(
            'wordSelectingPhaseStarted',
            (data: {
                playerList: Record<string, PlayerInfo>;
                currentDrawer: string;
                drawerQueue: string[];
                isWordSelectingPhase: boolean;
                phaseEndsInMs: number;
            }) => {
                setCurrentRoomInfo((prevRoomInfo) => ({
                    ...prevRoomInfo,
                    playerList: data.playerList,
                    currentDrawer: data.currentDrawer,
                    drawerQueue: data.drawerQueue,
                    isWordSelectingPhase: data.isWordSelectingPhase,
                    currentWord: '',
                }));
                anchorPhaseDeadline(data.phaseEndsInMs);
            },
        );

        // ONLY drawer of the current round will receive this event.
        // If they never pick, the server falls back to the first choice — that
        // deadline used to live here, in the drawer's own browser.
        socket.on('drawerReceiveWordChoices', (wordChoices: string[]) => {
            setCurrentRoomInfo((prevRoomInfo) => ({
                ...prevRoomInfo,
                wordChoices: wordChoices,
            }));
        });

        socket.on(
            'drawingPhaseStarted',
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

        // ONLY drawer of the current round will receive this event
        socket.on('drawingPhaseStartedForDrawer', (word: string) => {
            setCurrentRoomInfo((prevRoomInfo) => ({
                ...prevRoomInfo,
                currentWord: word,
            }));
        });

        socket.on(
            'playersReceivedPointsFromCorrectGuess',
            (updatedPlayerList: Record<string, PlayerInfo>) => {
                setCurrentRoomInfo((prevRoomInfo) => ({
                    ...prevRoomInfo,
                    playerList: updatedPlayerList,
                }));
            },
        );

        socket.on(
            'reviewingPhaseStarted',
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

        socket.on(
            'reviewingPhaseEnded',
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

        socket.on(
            'endDrawAndGuessGame',
            (currentRoomInfo: DrawAndGuessDetailRoomInfo) => {
                setCurrentRoomInfo((prevRoomInfo) => ({
                    ...prevRoomInfo,
                    ...currentRoomInfo,
                }));
                anchorPhaseDeadline(0);
            },
        );

        return () => {
            socket.off('clientJoinDrawAndGuessRoomSuccess');
            socket.off('rejectClientJoinDrawAndGuessRoomRequest');
            socket.off('clientLeaveDrawAndGuessRoomSuccess');
            socket.off('roomError');
            socket.off('startDrawAndGuessGameSuccess');
            socket.off('startNewRoundSuccess');
            socket.off('wordSelectingPhaseStarted');
            socket.off('drawerReceiveWordChoices');
            socket.off('drawingPhaseStarted');
            socket.off('drawingPhaseStartedForDrawer');
            socket.off('playersReceivedPointsFromCorrectGuess');
            socket.off('reviewingPhaseStarted');
            socket.off('reviewingPhaseEnded');
            socket.off('endDrawAndGuessGame');
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket]);

    // Declared after the effect that registers the listeners, so it runs after
    // them: by the time the server hears this, we are ready for the reply.
    // The join broadcast is sent while this page is still navigating, so
    // asking once mounted is what makes arriving in a room deterministic.
    useEffect(() => {
        if (roomId) {
            socket.emit('requestDrawAndGuessRoomState', roomId);
        }
    }, [socket, roomId]);

    useEffect(() => {
        return () => {
            if (currentRoomInfoRef.current.roomId !== '') {
                socket.emit(
                    'clientLeaveDrawAndGuessRoom',
                    currentRoomInfoRef.current.roomId,
                    username,
                );
            }
        };
    }, [socket, username]);

    const handleOnLeave = () => {
        navigate('/Gamehub/DrawAndGuess/Lobby');
    };

    const handleStartGame = () => {
        socket.emit('startDrawAndGuessGame', currentRoomInfo.roomId);
    };

    const renderLeftAndRightBodyContent = () => {
        return (
            <>
                {/* Player Info Section */}
                <div className="draw-and-guess-room-body-left">
                    {sortPlayerListByPoints(currentRoomInfo.playerList).map(
                        ([socketId, playerInfo], index) => (
                            <PlayerInfoContainer
                                key={socketId}
                                playerInfo={playerInfo}
                                isClient={socketId === socket.id}
                                isCurrentPlayerRoomOwner={
                                    socketId === currentRoomInfo.owner.socketId
                                }
                                isCurrentPlayerDrawer={
                                    socketId === currentRoomInfo.currentDrawer
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
                        isWordSelectingPhase={
                            currentRoomInfo.isWordSelectingPhase
                        }
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
                                isWordSelectingPhase={
                                    currentRoomInfo.isWordSelectingPhase
                                }
                                isDrawingPhase={currentRoomInfo.isDrawingPhase}
                                isReviewingPhase={
                                    currentRoomInfo.isReviewingPhase
                                }
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
