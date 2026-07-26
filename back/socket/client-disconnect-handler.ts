import type { Socket } from 'socket.io';
import type { RoomMembership } from './draw-and-guess/membership.js';

/**
 * A dropped connection is no longer a departure.
 *
 * This file used to hold its own copy of the whole leave sequence — recount,
 * transfer ownership, delete the room if empty, tell the engine — which is how
 * it came to disagree with the explicit leave handler about whether to check
 * membership first. Both go through `membership` now, which is also where the
 * decision lives about how long to wait before believing somebody is gone.
 */
const clientDepartureOnDisconnectHandler = (
  socket: Socket,
  membership: RoomMembership,
) => {
  socket.on('disconnect', () => {
    console.log('client: ' + socket.id + ' disconnected');
    membership.handleDisconnect(socket.id);
  });
};

export { clientDepartureOnDisconnectHandler };
