import type { Server } from 'socket.io';
import type { GameType } from '../../../shared/wire-types.js';
import type { PlayerSessionRegistry } from '../player-session.js';
import type { GameContext, GameModule, Room, RoomLookup } from './types.js';
import { emitToLobby, emitToRoom } from './emit.js';

const SYSTEM = '📢 System';

/**
 * Every room on the server, and which module speaks for each.
 *
 * One flat record keyed by room id rather than one per game: room ids are
 * unique across the process, and a departure or a disconnect has to find a
 * player's rooms without being told which game they were playing. `ofType`
 * is what puts the game back on before a module reads its own state.
 *
 * Modules are registered after the registry exists because each one needs the
 * registry to look rooms up and to announce things. The cycle is broken by the
 * order rather than by a lazy reference: nothing is called on a module until
 * a connection arrives, which is long after every module is in place.
 */
const createRoomRegistry = (io: Server, sessions: PlayerSessionRegistry) => {
  const all: Record<string, Room> = {};
  const modules = new Map<GameType, GameModule>();

  const lookup: RoomLookup = {
    all,
    get: (roomId) => all[roomId],
    ofType: <TGameState>(roomId: string, gameType: GameType) => {
      const room = all[roomId];
      if (!room) return undefined;
      if (room.gameType !== gameType) return undefined;
      return room as Room<TGameState>;
    },
    emitLobby: (gameType) => {
      const module = modules.get(gameType);
      if (!module) return;

      const rooms = Object.values(all)
        .filter((room) => room.gameType === gameType)
        .map((room) => module.toLobbyInfo(room));

      emitToLobby(io, gameType, 'lobby:rooms', gameType, rooms);
    },
    announce: (roomId, message) => {
      emitToRoom(io, roomId, 'chat:message', SYSTEM, message);
    },
  };

  const context: GameContext = { io, sessions, rooms: lookup };

  const register = (module: GameModule): void => {
    modules.set(module.gameType, module);
  };

  const moduleFor = (gameType: GameType): GameModule | undefined =>
    modules.get(gameType);

  /** The module that speaks for this room, found from the room itself. */
  const moduleOf = (room: Room): GameModule | undefined =>
    modules.get(room.gameType);

  const registeredTypes = (): GameType[] => [...modules.keys()];

  /** Rooms this player holds a seat in, connected or not, across every game. */
  const roomsHeldBy = (playerId: string): Room[] =>
    Object.values(all).filter((room) => room.playerList[playerId]);

  const dispose = (): void => {
    for (const module of modules.values()) module.dispose();
  };

  return {
    all,
    lookup,
    context,
    register,
    moduleFor,
    moduleOf,
    registeredTypes,
    roomsHeldBy,
    dispose,
  };
};

type RoomRegistry = ReturnType<typeof createRoomRegistry>;

export { createRoomRegistry, SYSTEM };
export type { RoomRegistry };
