import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

/**
 * Player identity that outlives a socket.
 *
 * Until now identity *was* the socket id, which has one great property - it
 * comes from the connection, so a client cannot claim to be someone else - and
 * one fatal one: it changes on every reload. Refreshing the page therefore made
 * you a different person, which is why a refresh lost your score.
 *
 * A player id alone cannot replace it. Every id in a room is broadcast to
 * everyone in that room, so an id on its own would let any player take any
 * other player's seat just by sending theirs. The id is paired with a secret
 * token that only its owner ever receives, and resuming requires both.
 *
 * Which player a socket speaks for is kept on the socket (`socket.data`), and
 * each player's socket sits in a channel of the player's own, which is how
 * anything reaches one player. This registry keeps what outlives a socket: the
 * token, and which socket is the current one.
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

  /** Mints a new identity, not yet speaking through any socket. */
  const issue = (): PlayerSession => {
    const session: PlayerSession = {
      playerId: randomUUID(),
      token: randomBytes(32).toString('hex'),
      socketId: null,
    };
    sessionsByPlayerId.set(session.playerId, session);
    return session;
  };

  /**
   * The identity a claim proves, if it does. A wrong or unknown one returns
   * null; the caller mints a fresh identity rather than reporting which part
   * was wrong.
   */
  const resume = (playerId: string, token: string): PlayerSession | null => {
    const session = sessionsByPlayerId.get(playerId);
    if (!session) return null;
    if (!constantTimeEquals(session.token, token)) return null;
    return session;
  };

  /**
   * Makes this socket the one speaking for the player, and returns the one it
   * replaces, if another was still connected: a duplicated tab carries the
   * same identity, and a player is in one place at a time, so the caller
   * closes the older one.
   */
  const attach = (session: PlayerSession, socketId: string): string | null => {
    const replaced = session.socketId;
    session.socketId = socketId;
    return replaced === socketId ? null : replaced;
  };

  const socketIdFor = (playerId: string): string | null =>
    sessionsByPlayerId.get(playerId)?.socketId ?? null;

  const isOnline = (playerId: string): boolean =>
    socketIdFor(playerId) !== null;

  /**
   * Marks the player away without forgetting who they are, if this socket was
   * still the one speaking for them. False when another has taken over, and
   * the player has not gone anywhere.
   */
  const detach = (playerId: string, socketId: string): boolean => {
    const session = sessionsByPlayerId.get(playerId);
    if (session?.socketId !== socketId) return false;
    session.socketId = null;
    return true;
  };

  /**
   * Drops an identity for good. Called once a player is no longer in any room,
   * so the registry does not grow for the lifetime of the process.
   */
  const forget = (playerId: string): void => {
    sessionsByPlayerId.delete(playerId);
  };

  const size = (): number => sessionsByPlayerId.size;

  return {
    issue,
    resume,
    attach,
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
