import { createContext, useContext } from 'react';
import type {
  AnyRoomState,
  ChatMessage,
  PlayerInfo,
} from '../../../shared/wire-types';
import type { CanvasStream } from '../net/canvas-stream';
import type { ZumpoSocket } from '../net/socket';

/** Everything a game's room view needs from the room around it. */
export interface Room<State extends AnyRoomState = AnyRoomState> {
  state: State;
  /** When the snapshot arrived; its clocks count from here. */
  receivedAt: number;
  /** The connection is down; the server holds the seat meanwhile. */
  reconnecting: boolean;
  reconnectGraceMs: number;
  playerId: string;
  me: PlayerInfo;
  isHost: boolean;
  chat: readonly ChatMessage[];
  canvas: CanvasStream;
  socket: ZumpoSocket;
  sendChat: (text: string) => void;
  /** Asks the server to start a game; `starting` until it answers. */
  startGame: () => void;
  starting: boolean;
  openInvite: () => void;
  /** The Leave room button: goes at once between games, asks mid-game. */
  leave: () => void;
}

export const RoomContext = createContext<Room | null>(null);

export function useRoomContext<State extends AnyRoomState>(): Room<State> {
  const room = useContext(RoomContext);
  if (!room) throw new Error('useRoomContext needs a seated room above it');
  return room as Room<State>;
}
