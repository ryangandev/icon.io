import type { PlayerSessionRegistry } from '../libs/player-session.js';
import { identityClaim } from '../libs/validation.js';
import { onClientRequest, type IoSocket } from '../libs/rooms/emit.js';

/**
 * The first thing a client says on every connection: either "I am nobody yet"
 * or "I was this player, and here is the proof".
 *
 * Either way it is answered with an identity, which the client stores in
 * `sessionStorage` (per tab, and surviving a reload, which is exactly the
 * lifetime a player's seat should have), and with how long a dropped
 * connection keeps its seats, for the reconnecting notice.
 *
 * Only then is a returning player put back in their seats. Their room pages
 * have not mounted yet, so what they see of the room arrives when each page
 * asks for it, over `room:sync`.
 */
const playerSessionHandler = (
  socket: IoSocket,
  sessions: PlayerSessionRegistry,
  reconnectGraceMs: number,
  onResume: (playerId: string) => void,
) => {
  onClientRequest(socket, 'session:identify', ([rawClaim], reply) => {
    // An absent or malformed claim is not an error worth reporting: saying
    // "wrong token" tells someone probing that the id itself was real. They
    // simply become a new player.
    const claim = identityClaim.safeParse(rawClaim);
    const resumed = claim.success
      ? sessions.resume(claim.data.playerId, claim.data.token, socket.id)
      : null;

    const session = resumed ?? sessions.issue(socket.id);

    reply({
      playerId: session.playerId,
      token: session.token,
      reconnectGraceMs,
    });

    if (resumed) onResume(session.playerId);
  });
};

export { playerSessionHandler };
