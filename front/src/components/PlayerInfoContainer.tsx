import { useEffect, useState } from 'react';
import '../styles/PlayerInfoContainer.css';
import scoreIcon from '../assets/score-icon.png';
import { useSocket } from '../hooks/useSocket';

interface PlayerInfoProps {
    username: string;
    roomId: string | undefined;
}

interface PlayerInfoContainerProps {
    roomId: string | undefined;
}

const PlayerInfo: React.FC<PlayerInfoProps> = (props: PlayerInfoProps) => {
    const { socket } = useSocket();
    const [score, setScore] = useState<number>(0);
    const [isDrawer, setIsDrawer] = useState<boolean>(false);
    const roomId = props.roomId;
    const userName = props.username;

    useEffect(() => {
        const onReceiveScore = (updatedScore: number, user: string) => {
            if (user === userName) {
                setScore(updatedScore);
            }
        };

        const onCorrectAnswer = (user: string, room: string) => {
            if (userName === user && roomId === room) {
                const newScore = score + 100;
                setScore(newScore);
                socket.emit('updatedScore', newScore, userName, roomId);
            }
        };

        socket.on('receiveScore', onReceiveScore);
        socket.on('correctAnswer', onCorrectAnswer);

        // Clean up the listeners when the component unmounts
        return () => {
            socket.off('receiveScore', onReceiveScore);
            socket.off('correctAnswer', onCorrectAnswer);
        };
    }, [socket, userName, roomId, score]);

    return (
        <div className={isDrawer ? 'player-info-drawer' : 'player-info'}>
            <div className="player-info-name">
                {props.username}{' '}
                {props.username === localStorage.getItem('username')
                    ? '(You)'
                    : ''}
            </div>
            <div className="player-info-score">
                <img
                    src={scoreIcon}
                    style={{ height: 20, width: 20, marginRight: 5 }}
                    alt="score"
                />
                {score} points
            </div>
        </div>
    );
};

const PlayerInfoContainer: React.FC<PlayerInfoContainerProps> = (
    props: PlayerInfoContainerProps,
) => {
    const { socket } = useSocket();
    const [playerList, setPlayerList] = useState<string[]>([]);

    useEffect(() => {
        socket.on('updatePlayers', (updatedPlayerList: string[]) => {
            setPlayerList(updatedPlayerList);
        });

        return () => {
            socket.off('updatePlayers');
        };
    }, [socket, playerList, props.roomId]);

    return (
        <div className="player-info-container">
            {playerList.map((username) => (
                <PlayerInfo
                    key={username}
                    username={username}
                    roomId={props.roomId}
                />
            ))}
        </div>
    );
};

export default PlayerInfoContainer;
