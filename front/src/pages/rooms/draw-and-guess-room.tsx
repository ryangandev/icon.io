import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import WhiteBoardCanvas from '../../components/whiteboard-canvas';
import ChatWindow from '../../components/chat-window';
import PlayerInfoContainer from '../../components/player-info-container';
import GameInfoBar from '../../components/game-info-bar';
import { Modal } from 'antd';
import '../../styles/pages/rooms/draw-and-guess-room.css';
import { useSocket } from '../../hooks/useSocket';
import {
    DrawAndGuessDetailRoomInfo,
    PlayerInfo,
    RoomStatus,
} from '../../models/types';
import GameInfoBoard from '../../components/game-info-board';
import { CustomError } from '../../models/error';
import toast from 'react-hot-toast';
import { roomInfoInitialObject } from '../../data/roomInfo';
import useScreenSize from '../../hooks/useScreenSize';
import { timer } from '../../data/timer';
import { sortPlayerListByPoints } from '../../libs/utils';

const DrawAndGuessRoom = () => {
    const { socket } = useSocket();
    const navigate = useNavigate();
    const username = sessionStorage.getItem('username');
    const [roomDoesNotExist, setRoomDoesNotExist] = useState<boolean>(false);
    const { currentScreenWidth } = useScreenSize();
    const isSmallerScreen = currentScreenWidth < 1200;

    // Room info attributes
    const [currentRoomInfo, setCurrentRoomInfo] =
        useState<DrawAndGuessDetailRoomInfo>(roomInfoInitialObject);
    const currentRoomInfoRef = useRef(currentRoomInfo); // Use ref to store currentRoomInfo to avoid stale closure during useEffect
    const isDrawer = currentRoomInfo.currentDrawer === socket.id;
    const isRoomOwner = currentRoomInfo.owner.socketId === socket.id;
    const currentDrawerUsername =
        currentRoomInfo.playerList[currentRoomInfo.currentDrawer]?.username;
    const receivedPointsThisTurn =
        currentRoomInfo.playerList[socket.id]?.receivedPointsThisTurn;

    // Timer attributes
    const [wordSelectPhaseTimer, setWordSelectPhaseTimer] = useState<number>(0);
    const [drawingPhaseTimer, setDrawingPhaseTimer] = useState<number>(0);
    const [reviewingPhaseTimer, setReviewingPhaseTimer] = useState<number>(0);
    // Use ref to store timeout id to avoid stale closure during useEffect
    const wordSelectingPhaseTimeoutId = useRef<NodeJS.Timeout | null>(null);
    const drawingPhaseTimeoutId = useRef<NodeJS.Timeout | null>(null);
    const reviewingPhaseTimeoutId = useRef<NodeJS.Timeout | null>(null);
    // The refs below are for storing the start time of each phase to apply date based solution to setTimeout and setInterval
    const wordSelectingPhaseIntervalStartTimeRef = useRef<number | null>(null);
    const drawingPhaseIntervalStartTimeRef = useRef<number | null>(null);
    const reviewingPhaseIntervalStartTimeRef = useRef<number | null>(null);
    const wordSelectingPhaseTimeoutStartTimeRef = useRef<number | null>(null);
    const drawingPhaseTimeoutStartTimeRef = useRef<number | null>(null);
    const reviewingPhaseTimeoutStartTimeRef = useRef<number | null>(null);

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
            },
        );

        socket.on(
            'clientLeaveDrawAndGuessRoomSuccess',
            (currentRoomInfo: DrawAndGuessDetailRoomInfo) => {
                setCurrentRoomInfo((prevRoomInfo) => ({
                    ...prevRoomInfo,
                    ...currentRoomInfo,
                }));
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
                    drawerQueue: new Set(data.drawerQueue),
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
            }) => {
                setCurrentRoomInfo((prevRoomInfo) => ({
                    ...prevRoomInfo,
                    playerList: data.playerList,
                    currentDrawer: data.currentDrawer,
                    drawerQueue: new Set(data.drawerQueue),
                    isWordSelectingPhase: data.isWordSelectingPhase,
                }));
                setWordSelectPhaseTimer(timer.wordSelectPhaseTimer);
            },
        );

        // ONLY drawer of the current round will receive this event
        socket.on('drawerReceiveWordChoices', (wordChoices) => {
            setCurrentRoomInfo((prevRoomInfo) => ({
                ...prevRoomInfo,
                wordChoices: wordChoices,
            }));

            // Clear any previous timeout before setting a new one
            if (wordSelectingPhaseTimeoutId.current) {
                clearTimeout(wordSelectingPhaseTimeoutId.current);
            }

            // Record the start time of the word selecting phase
            wordSelectingPhaseTimeoutStartTimeRef.current = Date.now();

            // Drawer has 15 seconds to select a word
            wordSelectingPhaseTimeoutId.current = setTimeout(() => {
                const expectedEndTime =
                    (wordSelectingPhaseTimeoutStartTimeRef.current || 0) +
                    timer.wordSelectPhaseTimer * 1000;
                const actualEndTime = Date.now();
                if (
                    actualEndTime >= expectedEndTime &&
                    currentRoomInfoRef.current.currentWord === ''
                ) {
                    socket.emit(
                        'drawerSelectWordFinished',
                        currentRoomInfoRef.current.roomId,
                        wordChoices[0],
                    );
                }
            }, timer.wordSelectPhaseTimer * 1000);
        });

        socket.on(
            'drawingPhaseStarted',
            (data: {
                currentWordHint: string;
                isWordSelectingPhase: boolean;
                isDrawingPhase: boolean;
                wordChoices: string[];
            }) => {
                setCurrentRoomInfo((prevRoomInfo) => ({
                    ...prevRoomInfo,
                    currentWordHint: data.currentWordHint,
                    isWordSelectingPhase: data.isWordSelectingPhase,
                    isDrawingPhase: data.isDrawingPhase,
                    wordChoices: data.wordChoices,
                }));
                setWordSelectPhaseTimer(0);
                setDrawingPhaseTimer(timer.drawingPhaseTimer);
            },
        );

        // ONLY drawer of the current round will receive this event
        socket.on('drawingPhaseStartedForDrawer', (word: string) => {
            setCurrentRoomInfo((prevRoomInfo) => ({
                ...prevRoomInfo,
                currentWord: word,
            }));

            // Clear any previous timeout before setting a new one
            if (drawingPhaseTimeoutId.current) {
                clearTimeout(drawingPhaseTimeoutId.current);
            }

            // Record the start time of the drawing phase
            drawingPhaseTimeoutStartTimeRef.current = Date.now();

            drawingPhaseTimeoutId.current = setTimeout(() => {
                const expectedEndTime =
                    (drawingPhaseTimeoutStartTimeRef.current || 0) +
                    timer.drawingPhaseTimer * 1000;
                const actualEndTime = Date.now();

                if (actualEndTime >= expectedEndTime) {
                    socket.emit(
                        'drawingPhaseTimerEnded',
                        currentRoomInfoRef.current.roomId,
                    );
                }
            }, timer.drawingPhaseTimer * 1000);
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
            }) => {
                console.log('reviewingPhaseStarted event received: ', data);
                setCurrentRoomInfo((prevRoomInfo) => ({
                    ...prevRoomInfo,
                    isDrawingPhase: data.isDrawingPhase,
                    isReviewingPhase: data.isReviewingPhase,
                    currentWord: data.currentWord,
                }));
                setDrawingPhaseTimer(0);
                setReviewingPhaseTimer(timer.reviewingPhaseTimer);

                // Only the drawer will continue to emit the below event
                if (currentRoomInfoRef.current.currentDrawer !== socket.id)
                    return;

                // Clear any previous timeout before setting a new one
                if (reviewingPhaseTimeoutId.current) {
                    clearTimeout(reviewingPhaseTimeoutId.current);
                }

                // Record the start time of the reviewing phase
                reviewingPhaseTimeoutStartTimeRef.current = Date.now();

                reviewingPhaseTimeoutId.current = setTimeout(() => {
                    const expectedEndTime =
                        (reviewingPhaseTimeoutStartTimeRef.current || 0) +
                        timer.reviewingPhaseTimer * 1000;
                    const actualEndTime = Date.now();

                    if (actualEndTime >= expectedEndTime) {
                        socket.emit(
                            'reviewingPhaseTimerEnded',
                            currentRoomInfoRef.current.roomId,
                        );
                    }
                }, timer.reviewingPhaseTimer * 1000);
            },
        );

        socket.on(
            'reviewingPhaseEnded',
            (data: {
                isReviewingPhase: boolean;
                currentDrawer: string;
                currentWord: string;
                currentWordHint: string;
            }) => {
                console.log('reviewingPhaseEnded event received: ', data);
                setCurrentRoomInfo((prevRoomInfo) => ({
                    ...prevRoomInfo,
                    isReviewingPhase: data.isReviewingPhase,
                    currentDrawer: data.currentDrawer,
                    currentWord: data.currentWord,
                    currentWordHint: data.currentWordHint,
                }));
                setReviewingPhaseTimer(0);
            },
        );

        socket.on(
            'endDrawAndGuessGame',
            (currentRoomInfo: DrawAndGuessDetailRoomInfo) => {
                console.log(
                    'endDrawAndGuessGame event received: ',
                    currentRoomInfo,
                );
                setCurrentRoomInfo((prevRoomInfo) => ({
                    ...prevRoomInfo,
                    ...currentRoomInfo,
                }));
            },
        );

        return () => {
            socket.off('clientJoinDrawAndGuessRoomSuccess');
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

            if (wordSelectingPhaseTimeoutId.current) {
                clearTimeout(wordSelectingPhaseTimeoutId.current);
            }
            if (drawingPhaseTimeoutId.current) {
                clearTimeout(drawingPhaseTimeoutId.current);
            }
        };
    }, [socket]);

    useEffect(() => {
        return () => {
            if (currentRoomInfoRef.current.roomId !== '') {
                console.log('Component unmounting triggered');
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
                        startTimeRef={drawingPhaseIntervalStartTimeRef}
                        drawingPhaseTimer={drawingPhaseTimer}
                        setDrawingPhaseTimer={setDrawingPhaseTimer}
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
                                wordSelectPhaseStartTimeRef={
                                    wordSelectingPhaseIntervalStartTimeRef
                                }
                                wordSelectPhaseTimer={wordSelectPhaseTimer}
                                setWordSelectPhaseTimer={
                                    setWordSelectPhaseTimer
                                }
                                reviewingPhaseStartTimeRef={
                                    reviewingPhaseIntervalStartTimeRef
                                }
                                reviewingPhaseTimer={reviewingPhaseTimer}
                                setReviewingPhaseTimer={setReviewingPhaseTimer}
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
