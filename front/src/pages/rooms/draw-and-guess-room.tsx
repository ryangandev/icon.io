import { useParams, useNavigate } from 'react-router-dom';
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

const DrawAndGuessRoom = () => {
    const { roomId } = useParams();
    const { socket } = useSocket();
    const navigate = useNavigate();
    const username = localStorage.getItem('username');

    const [currentRoomInfo, setCurrentRoomInfo] =
        useState<DrawAndGuessDetailRoomInfo | null>(null);
    const [roomError, setRoomError] = useState<boolean>(false);
    const [gameStart, setGameStart] = useState<boolean>(false);
    const isDrawer = currentRoomInfo?.currentDrawer === socket.id;
    const isRoomOwner = currentRoomInfo?.owner.socketId === socket.id;
    const isGameStarted = currentRoomInfo?.isGameStarted;

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

        socket.on('roomError', (roomError) => {
            console.log('roomError received: ', roomError);
            setRoomError(roomError);
        });

        return () => {
            socket.off('clientJoinDrawAndGuessRoomSuccess');
            socket.off('clientLeaveDrawAndGuessRoomSuccess');
            socket.off('drawer');
            socket.off('stop');
            socket.off('roomError');
        };
    }, [socket, roomId, username]);

    const handleOnLeave = () => {
        socket.emit('clientLeaveDrawAndGuessRoom', roomId);
        navigate('/Gamehub/DrawAndGuess/Lobby');
    };

    const handleStartGame = () => {
        setGameStart(true);

        socket.emit('startGame', true, roomId);
    };

    return (
        <>
            {roomError ? (
                <Modal
                    title="The room you are looking for does not exist."
                    open={roomError}
                    onOk={handleOnLeave}
                >
                    Click OK to be redirected to the lobby.
                </Modal>
            ) : (
                <div className="draw-and-guess-room-layout">
                    <GameInfoBar handleOnLeave={handleOnLeave} />

                    <div className="draw-and-guess-room-body">
                        <div className="draw-and-guess-room-body-left">
                            {Object.entries(
                                currentRoomInfo?.playerList || {},
                            ).map(([socketId, playerInfo]) => (
                                <PlayerInfoContainer
                                    key={socketId}
                                    playerInfo={playerInfo}
                                    isClient={socketId === socket.id}
                                    isCurrentDrawer={
                                        socketId ===
                                        currentRoomInfo?.currentDrawer
                                    }
                                />
                            ))}
                        </div>

                        <div className="draw-and-guess-room-body-center">
                            <WhiteBoardCanvas
                                userName={username}
                                roomId={roomId}
                                isDrawer={isDrawer}
                            />
                        </div>

                        <div className="draw-and-guess-room-body-right">
                            <ChatWindow
                                userName={username}
                                roomId={roomId}
                                isDrawer={isDrawer}
                                gameStart={gameStart}
                            />
                            {isRoomOwner && !isGameStarted && (
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
