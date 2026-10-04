import { useEffect, useState } from 'react';
import type { AnyLobbyRoomInfo, GameType } from '../../../shared/wire-types';
import { useConnectedSession } from './session';

/**
 * One game's room list, live. `null` until the server's first answer, and
 * again after a reconnection until the list arrives anew.
 */
export function useLobby(gameType: GameType): AnyLobbyRoomInfo[] | null {
  const { socket, status, connectionId } = useConnectedSession();
  const [rooms, setRooms] = useState<AnyLobbyRoomInfo[] | null>(null);
  const online = status === 'online';

  useEffect(() => {
    if (!online) return;
    const onRooms = (type: GameType, list: AnyLobbyRoomInfo[]) => {
      if (type === gameType) setRooms(list);
    };
    socket.on('lobby:rooms', onRooms);
    socket.emit('lobby:subscribe', gameType);
    return () => {
      socket.off('lobby:rooms', onRooms);
      // A dropped connection already ended the subscription on the server.
      if (socket.connected) socket.emit('lobby:unsubscribe', gameType);
      setRooms(null);
    };
  }, [socket, online, connectionId, gameType]);

  return rooms;
}
