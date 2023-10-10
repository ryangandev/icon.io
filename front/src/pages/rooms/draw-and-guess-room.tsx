import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import CanvasDrawing from '../../components/drawable-canvas';
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

    const [isDrawer, setIsDrawer] = useState<boolean>(true);
    const [isPending, setIsPending] = useState<boolean>(true);
    const [roomError, setRoomError] = useState<boolean>(false);
    const [wordForDrawer, setWordForDrawer] = useState<string>('');
    const [gameStart, setGameStart] = useState<boolean>(false);
    const [currentRoomInfo, setCurrentRoomInfo] =
        useState<DrawAndGuessDetailRoomInfo | null>(null);

    // https://socket.io/how-to/use-with-react
    useEffect(() => {
        socket.on(
            'newClientJoinDrawAndGuessRoomSuccess',
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
            socket.off('newClientJoinDrawAndGuessRoomSuccess');
            socket.off('drawer');
            socket.off('stop');
            socket.off('roomError');
        };
    }, [socket, roomId, username]);

    const handleOnLeave = () => {
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
                <div className="room-container">
                    <div className="game-info-header">
                        <GameInfoBar
                            roomId={roomId}
                            isDrawer={isDrawer}
                            wordForDrawer={wordForDrawer}
                            handleOnLeave={handleOnLeave}
                        />
                    </div>
                    <div className="body-container">
                        <PlayerInfoContainer roomId={roomId} />
                        <div style={{ marginLeft: 10, marginRight: 10 }}>
                            <CanvasDrawing
                                userName={username}
                                roomId={roomId}
                                isDrawer={isDrawer}
                            />
                        </div>
                        <div className="right-room">
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
                                    Start the game!
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
