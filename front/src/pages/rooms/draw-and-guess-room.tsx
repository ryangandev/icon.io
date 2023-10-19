import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import WhiteBoardCanvas from '../../components/whiteboard-canvas';
import ChatWindow from '../../components/chat-window';
import PlayerInfoContainer from '../../components/player-info-container';
import GameInfoBar from '../../components/game-info-bar';
import { Modal } from 'antd';
import '../../styles/pages/rooms/draw-and-guess-room.css';
import { Button } from 'antd';
import { useSocket } from '../../hooks/useSocket';
import { DrawAndGuessDetailRoomInfo } from '../../models/types';
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
            currentRound: 0,
            isGameStarted: false,
        });
    const [roomDoesNotExist, setRoomDoesNotExist] = useState<boolean>(false);
    const isDrawer = currentRoomInfo.currentDrawer === socket.id;
    const isRoomOwner = currentRoomInfo.owner.socketId === socket.id;

    useEffect(() => {
        socket.on(
            'clientJoinDrawAndGuessRoomSuccess',
            (currentRoomInfo: DrawAndGuessDetailRoomInfo) => {
                console.log(
                    'Client ' + socket.id + ' joined room: ',
                    currentRoomInfo.roomId,
                    ' successfully! Current Room info: ',
                    currentRoomInfo,
                );
                setCurrentRoomInfo(currentRoomInfo);
            },
        );

        socket.on(
            'clientLeaveDrawAndGuessRoomSuccess',
            (currentRoomInfo: DrawAndGuessDetailRoomInfo) => {
                console.log(
                    'Client ' + socket.id + ' left room: ',
                    currentRoomInfo.roomId,
                    ' successfully! Current Room info: ',
                    currentRoomInfo,
                );
                setCurrentRoomInfo(currentRoomInfo);
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

        return () => {
            socket.off('clientJoinDrawAndGuessRoomSuccess');
            socket.off('clientLeaveDrawAndGuessRoomSuccess');
            socket.off('roomError');
        };
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
                    <GameInfoBar handleOnLeave={handleOnLeave} />

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
