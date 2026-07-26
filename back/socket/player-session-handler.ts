import type { Socket } from 'socket.io';
import type { PlayerSessionRegistry } from '../libs/player-session.js';
import { parseArgs, resumeSessionRequest } from '../libs/validation.js';

/**
 * The first thing a client says after connecting: either "I am nobody yet" or
 * "I was this player, and here is the proof".
 *
 * Either way the server replies with an identity, which the client stores in
 * `sessionStorage` — per tab, and surviving a reload, which is exactly the
 * lifetime a player's seat should have.
 */
const playerSessionHandler = (
  socket: Socket,
  sessions: PlayerSessionRegistry,
  onResume: (playerId: string) => void,
) => {
  socket.on('identifyPlayer', (...rawArgs: unknown[]) => {
    // An absent claim is normal — a first visit has nothing to present.
    const claim =
      rawArgs.length === 0 || rawArgs[0] == null
        ? null
        : parseArgs(resumeSessionRequest, rawArgs, 'identifyPlayer');

    const resumed = claim
      ? sessions.resume(claim[0].playerId, claim[0].token, socket.id)
      : null;

    // A claim that does not check out is not an error worth reporting: saying
    // "wrong token" tells someone probing that the id itself was real. They
    // simply become a new player.
    const session = resumed ?? sessions.issue(socket.id);

    socket.emit('playerIdentity', {
      playerId: session.playerId,
      token: session.token,
    });

    if (resumed) onResume(session.playerId);
  });
};

export { playerSessionHandler };
