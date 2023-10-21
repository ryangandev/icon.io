import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import WhiteBoardCanvas from '../../components/whiteboard-canvas';
import ChatWindow from '../../components/chat-window';
import PlayerInfoContainer from '../../components/player-info-container';
import GameInfoBar from '../../components/game-info-bar';
import { Modal } from 'antd';
import '../../styles/pages/rooms/draw-and-guess-room.css';
import { Button } from 'antd';
import { useSocket } from '../../hooks/useSocket';
import { DrawAndGuessDetailRoomInfo, RoomStatus } from '../../models/types';
import GameInfoBoard from '../../components/game-info-board';
import { CustomError } from '../../models/error';
import toast from 'react-hot-toast';

const DrawAndGuessRoom = () => {
    const { socket } = useSocket();
    const navigate = useNavigate();
    const username = sessionStorage.getItem('username');
    const [currentRoomInfo, setCurrentRoomInfo] =
        useState<DrawAndGuessDetailRoomInfo>({
            roomId: '',
            roomName: '',
            owner: {
                username: '',
                socketId: '',
            },
            status: 'open',
            currentPlayerCount: 0,
            maxPlayers: 0,
            rounds: 0,
            password: '',
            playerList: {},
            currentDrawer: '', // current drawer's socket id
            currentWord: '',
            currentWordLength: 0,
            currentRound: 0,
            isGameStarted: false,
            isWordSelectingPhase: false,
            isDrawingPhase: false,
            isReviewingPhase: false,
            drawerQueue: new Set(),
            wordCategory: '',
            wordChoices: [],
        });
    const currentRoomInfoRef = useRef(currentRoomInfo); // Use ref to store currentRoomInfo to avoid stale closure during useEffect
    const [roomDoesNotExist, setRoomDoesNotExist] = useState<boolean>(false);
    const isDrawer = currentRoomInfo.currentDrawer === socket.id;
    const isRoomOwner = currentRoomInfo.owner.socketId === socket.id;

    const timer = {
        wordSelectPhaseTimer: 15,
        drawingPhaseTimer: 15,
    };
    const [wordSelectPhaseTimer, setWordSelectPhaseTimer] = useState<number>(
        timer.wordSelectPhaseTimer,
    );
    const [drawingPhaseTimer, setDrawingPhaseTimer] = useState<number>(
        timer.drawingPhaseTimer,
    );
    // Use ref to store timeout id to avoid stale closure during useEffect
    const wordChoiceTimeoutId = useRef<NodeJS.Timeout | null>(null);
    const drawingPhaseTimeoutId = useRef<NodeJS.Timeout | null>(null);

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
                isGameStarted: boolean;
                status: RoomStatus;
                wordCategory: string;
            }) => {
                setCurrentRoomInfo((prevRoomInfo) => ({
                    ...prevRoomInfo,
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
                currentDrawer: string;
                drawerQueue: string[];
                isWordSelectingPhase: boolean;
            }) => {
                setCurrentRoomInfo((prevRoomInfo) => ({
                    ...prevRoomInfo,
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
            if (wordChoiceTimeoutId.current) {
                clearTimeout(wordChoiceTimeoutId.current);
            }

            // Drawer has 15 seconds to select a word
            wordChoiceTimeoutId.current = setTimeout(() => {
                if (currentRoomInfoRef.current.currentWord === '') {
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
                currentWordLength: number;
                isWordSelectingPhase: boolean;
                isDrawingPhase: boolean;
                wordChoices: string[];
            }) => {
                setCurrentRoomInfo((prevRoomInfo) => ({
                    ...prevRoomInfo,
                    currentWordLength: data.currentWordLength,
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

            drawingPhaseTimeoutId.current = setTimeout(() => {
                socket.emit(
                    'drawingPhaseTimerEnded',
                    currentRoomInfoRef.current.roomId,
                );
            }, timer.drawingPhaseTimer * 1000);
        });

        socket.on(
            'drawingPhaseEnded',
            (data: {
                isDrawingPhase: boolean;
                currentDrawer: string;
                currentWord: string;
                currentWordLength: number;
            }) => {
                setCurrentRoomInfo((prevRoomInfo) => ({
                    ...prevRoomInfo,
                    isDrawingPhase: data.isDrawingPhase,
                    currentDrawer: data.currentDrawer,
                    currentWord: data.currentWord,
                    currentWordLength: data.currentWordLength,
                }));
                setDrawingPhaseTimer(0);
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
            socket.off('drawingPhaseEnded');
            socket.off('endDrawAndGuessGame');

            if (wordChoiceTimeoutId.current) {
                clearTimeout(wordChoiceTimeoutId.current);
            }
            if (drawingPhaseTimeoutId.current) {
                clearTimeout(drawingPhaseTimeoutId.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket]);

    const handleOnLeave = () => {
        socket.emit(
            'clientLeaveDrawAndGuessRoom',
            currentRoomInfo.roomId,
            username,
        );
        navigate('/Gamehub/DrawAndGuess/Lobby');
    };

    const handleStartGame = () => {
        socket.emit('startDrawAndGuessGame', currentRoomInfo.roomId);
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
                        currentWord={currentRoomInfo.currentWord}
                        currentWordLength={currentRoomInfo.currentWordLength}
                        handleOnLeave={handleOnLeave}
                        drawingPhaseTimer={drawingPhaseTimer}
                        setDrawingPhaseTimer={setDrawingPhaseTimer}
                    />

                    <div className="draw-and-guess-room-body">
                        <div className="draw-and-guess-room-body-left">
                            {Object.entries(currentRoomInfo.playerList).map(
                                ([socketId, playerInfo]) => (
                                    <PlayerInfoContainer
                                        key={socketId}
                                        playerInfo={playerInfo}
                                        isClient={socketId === socket.id}
                                        isCurrentDrawer={
                                            socketId ===
                                            currentRoomInfo.currentDrawer
                                        }
                                    />
                                ),
                            )}
                        </div>

                        <div className="draw-and-guess-room-body-center">
                            <WhiteBoardCanvas
                                roomId={currentRoomInfo.roomId}
                                ownerName={currentRoomInfo.owner.username}
                                isDrawer={isDrawer}
                                isGameStarted={currentRoomInfo.isGameStarted}
                                isWordSelectingPhase={
                                    currentRoomInfo.isWordSelectingPhase
                                }
                                wordChoices={currentRoomInfo.wordChoices}
                                wordSelectPhaseTimer={wordSelectPhaseTimer}
                                setWordSelectPhaseTimer={
                                    setWordSelectPhaseTimer
                                }
                            />
                        </div>

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
                                rounds={
                                    currentRoomInfo.currentRound +
                                    '/' +
                                    currentRoomInfo.rounds
                                }
                            />
                            <ChatWindow
                                username={username}
                                roomId={currentRoomInfo.roomId}
                                isDrawer={isDrawer}
                                isGameStarted={currentRoomInfo.isGameStarted}
                            />
                            {isRoomOwner && !currentRoomInfo.isGameStarted && (
                                <Button
                                    onClick={handleStartGame}
                                    size="large"
                                    className="startBtn"
                                >
                                    START
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default DrawAndGuessRoom;
