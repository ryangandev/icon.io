import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

/**
 * Player identity that outlives a socket.
 *
 * Until now identity *was* the socket id, which has one great property — it
 * comes from the connection, so a client cannot claim to be someone else — and
 * one fatal one: it changes on every reload. Refreshing the page therefore made
 * you a different person, which is why a refresh lost your score.
 *
 * A player id alone cannot replace it. Every id in a room is broadcast to
 * everyone in that room, so an id on its own would let any player take any
 * other player's seat just by sending theirs. The id is paired with a secret
 * token that only its owner ever receives, and resuming requires both.
 */

interface PlayerSession {
  playerId: string;
  /** Never leaves the server except once, to the player it belongs to. */
  token: string;
  /** The socket currently speaking for this player, or null while away. */
  socketId: string | null;
}

interface PlayerIdentity {
  playerId: string;
  token: string;
}

const constantTimeEquals = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // length, so compare sizes first and always run the check.
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
};

const createPlayerSessionRegistry = () => {
  const sessionsByPlayerId = new Map<string, PlayerSession>();
  const playerIdBySocketId = new Map<string, string>();

  const attach = (session: PlayerSession, socketId: string): void => {
    // A player speaks through one socket at a time. If they open a second tab
    // with the same identity, the newer socket takes over rather than both
    // being treated as the same player in two places.
    if (session.socketId) playerIdBySocketId.delete(session.socketId);
    session.socketId = socketId;
    playerIdBySocketId.set(socketId, session.playerId);
  };

  /** Mints a new identity and binds it to this socket. */
  const issue = (socketId: string): PlayerSession => {
    const session: PlayerSession = {
      playerId: randomUUID(),
      token: randomBytes(32).toString('hex'),
      socketId: null,
    };
    sessionsByPlayerId.set(session.playerId, session);
    attach(session, socketId);
    return session;
  };

  /**
   * Rebinds an existing identity to a new socket, if the token proves it. A
   * wrong or unknown one returns null; the caller mints a fresh identity rather
   * than reporting which part was wrong.
   */
  const resume = (
    playerId: string,
    token: string,
    socketId: string,
  ): PlayerSession | null => {
    const session = sessionsByPlayerId.get(playerId);
    if (!session) return null;
    if (!constantTimeEquals(session.token, token)) return null;

    attach(session, socketId);
    return session;
  };

  const playerIdFor = (socketId: string): string | undefined =>
    playerIdBySocketId.get(socketId);

  const socketIdFor = (playerId: string): string | null =>
    sessionsByPlayerId.get(playerId)?.socketId ?? null;

  const isOnline = (playerId: string): boolean =>
    socketIdFor(playerId) !== null;

  /** Marks the player away without forgetting who they are. */
  const detach = (socketId: string): string | undefined => {
    const playerId = playerIdBySocketId.get(socketId);
    if (!playerId) return undefined;

    playerIdBySocketId.delete(socketId);
    const session = sessionsByPlayerId.get(playerId);
    // Only clear the pointer if it still refers to this socket — a second tab
    // may already have taken the identity over.
    if (session?.socketId === socketId) session.socketId = null;

    return playerId;
  };

  /**
   * Drops an identity for good. Called once a player is no longer in any room,
   * so the registry does not grow for the lifetime of the process.
   */
  const forget = (playerId: string): void => {
    const session = sessionsByPlayerId.get(playerId);
    if (session?.socketId) playerIdBySocketId.delete(session.socketId);
    sessionsByPlayerId.delete(playerId);
  };

  const size = (): number => sessionsByPlayerId.size;

  return {
    issue,
    resume,
    playerIdFor,
    socketIdFor,
    isOnline,
    detach,
    forget,
    size,
  };
};

type PlayerSessionRegistry = ReturnType<typeof createPlayerSessionRegistry>;

export { createPlayerSessionRegistry };
export type { PlayerSession, PlayerIdentity, PlayerSessionRegistry };
