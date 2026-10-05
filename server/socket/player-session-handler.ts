import type { PlayerSessionRegistry } from '../libs/player-session.js';
import { handshakeAuth } from '../libs/validation.js';
import {
  playerChannel,
  type IoServer,
  type IoSocket,
} from '../libs/rooms/emit.js';

/**
 * Who a new connection is, settled from its handshake before any of its events
 * are read: either "I am nobody yet" or "I was this player, and here is the
 * proof".
 *
 * Either way the connection is told its identity in `session:ready`, which the
 * client stores in `sessionStorage` (per tab, and surviving a reload, which is
 * exactly the lifetime a player's seat should have), with how long a dropped
 * connection keeps its seats, for the reconnecting notice.
 *
 * A player is in one place at a time. A duplicated tab carries the identity
 * of the tab it was copied from, and is indistinguishable from it, so the
 * newer connection takes over and the older one is told so and closed: left
 * open, it would sit in its rooms' channels, hear the chat, miss every
 * snapshot, and have every click ignored.
 *
 * Only then is a returning player put back in their seats. Their room pages
 * may not have mounted yet, so what they see of the room arrives when each page
 * asks for it, over `room:sync`.
 */
const playerSessionHandler = (
  io: IoServer,
  socket: IoSocket,
  sessions: PlayerSessionRegistry,
  reconnectGraceMs: number,
  onResume: (playerId: string) => void,
) => {
  // An absent or malformed claim is not an error worth reporting: saying
  // "wrong token" tells someone probing that the id itself was real. They
  // simply become a new player.
  const auth = handshakeAuth.safeParse(socket.handshake.auth);
  const claim = auth.success ? auth.data.identity : null;
  const resumed = claim ? sessions.resume(claim.playerId, claim.token) : null;
  const session = resumed ?? sessions.issue();

  socket.data.playerId = session.playerId;
  socket.join(playerChannel(session.playerId));
  const replaced = sessions.attach(session, socket.id);
  if (replaced) {
    const previous = io.sockets.sockets.get(replaced);
    previous?.emit('session:replaced');
    previous?.disconnect(true);
  }

  socket.emit('session:ready', {
    playerId: session.playerId,
    token: session.token,
    reconnectGraceMs,
  });

  if (resumed) onResume(session.playerId);
};

export { playerSessionHandler };
