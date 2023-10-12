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
    const navigate = useNavigate();
    const username = localStorage.getItem('username');
    const { socket } = useSocket();

    const [currentRoomInfo, setCurrentRoomInfo] =
        useState<DrawAndGuessDetailRoomInfo | null>(null);
    const [isDrawer, setIsDrawer] = useState<boolean>(true);
    const [isPending, setIsPending] = useState<boolean>(true);
    const [roomError, setRoomError] = useState<boolean>(false);
    const [wordForDrawer, setWordForDrawer] = useState<string>('');
    const [gameStart, setGameStart] = useState<boolean>(false);

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
                setIsPending(false);
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

        socket.on('drawer', (is_drawer, word) => {
            console.log(is_drawer, word);

            setIsDrawer(is_drawer);
            setWordForDrawer(word);
            setIsPending(false);
        });

        socket.on('stop', (data) => {
            setGameStart(data);
        });

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
            {isPending && <div>Loading...</div>}
            {roomError && (
                <Modal
                    title="The room you are looking for does not exist."
                    open={roomError}
                    onOk={handleOnLeave}
                >
                    Click OK to be redirected to the lobby.
                </Modal>
            )}
            {!isPending && (
                <div className="draw-and-guess-room-layout">
                    <GameInfoBar
                        roomId={roomId}
                        isDrawer={isDrawer}
                        wordForDrawer={wordForDrawer}
                        handleOnLeave={handleOnLeave}
                    />

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

                        {/* <div className="draw-and-guess-room-body-right">
                            <ChatWindow
                                userName={username}
                                roomId={roomId}
                                isDrawer={isDrawer}
                                gameStart={gameStart}
                            />
                            {isDrawer && !gameStart && (
                                <Button
                                    onClick={handleStartGame}
                                    size="large"
                                    className="startBtn"
                                >
                                    Start
                                </Button>
                            )}
                        </div> */}
                    </div>
                </div>
            )}
        </>
    );
};

export default DrawAndGuessRoom;
