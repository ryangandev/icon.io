import { z } from 'zod';

/**
 * Every value a client sends arrives as `any` off the socket. Nothing here was
 * checked before: `room:create` put `maxPlayers` and `roomName` straight into
 * game state, so a crafted client could ask for a room with a billion seats or
 * a megabyte-long name, and chat messages were unbounded on the wire even
 * though the input box caps them at 40 characters.
 *
 * The bounds below mirror what the UI already enforces, so a well-behaved client
 * never notices them.
 *
 * What is here is the room layer's: identity, lobbies, rooms, chat. A game's own
 * events are validated next to that game — `socket/draw-and-guess/validation.ts`
 * — out of the same primitives, which are exported for exactly that.
 */

const USERNAME_MAX = 18; // matches the landing page input
const ROOM_NAME_MAX = 40;
const PASSWORD_MAX = 20;
const MESSAGE_MAX = 40;

const trimmedString = (max: number) => z.string().trim().min(1).max(max);

// Room ids are generated with randomUUID(); anything else cannot match a room.
const roomId = z.string().uuid();
const username = trimmedString(USERNAME_MAX);
// `.optional().default('')` tolerates the field being absent — an unlocked room
// sends no password — without also swallowing an over-long one. Using `.catch()`
// here would substitute '' on failure, quietly creating an *unlocked* room from
// a request whose password was rejected.
const password = z.string().max(PASSWORD_MAX).optional().default('');
const gameType = z.enum(['draw-and-guess', 'minesweeper']);

/**
 * The generic half of a create request. `settings` is deliberately unchecked
 * here — only the game's module knows what it should contain, and it is handed
 * the raw value to accept or reject.
 */
const roomCreateRequest = z.object({
  gameType,
  roomName: trimmedString(ROOM_NAME_MAX),
  ownerUsername: username,
  maxPlayers: z.number().int().min(2).max(8),
  password: password,
  settings: z.unknown(),
});

/**
 * A returning client's claim to an existing identity. Both halves are exactly
 * the shape the server issued, so anything else is rejected before it reaches
 * the token comparison — and a rejected claim just gets a new identity, never
 * an error saying which half was wrong.
 */
const resumeSessionRequest = z.tuple([
  z.object({
    playerId: z.string().uuid(),
    token: z.string().regex(/^[0-9a-f]{64}$/),
  }),
]);

const gameTypeOnly = z.tuple([gameType]);
const joinRoomRequest = z.tuple([roomId, username, password]);
const leaveRoomRequest = z.tuple([roomId, username]);
const roomIdOnly = z.tuple([roomId]);
const chatRequest = z.tuple([roomId, username, trimmedString(MESSAGE_MAX)]);

/**
 * Parses socket arguments, returning `null` rather than throwing when they do
 * not fit. Handlers drop invalid events silently: a legitimate client cannot
 * produce them, and echoing details back only helps someone probing the API.
 */
const parseArgs = <T>(
  schema: z.ZodType<T>,
  args: unknown,
  eventName: string,
): T | null => {
  const result = schema.safeParse(args);

  if (!result.success) {
    console.warn(
      `Rejected "${eventName}": ${result.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'} ${issue.message}`)
        .join('; ')}`,
    );
    return null;
  }

  return result.data;
};

export {
  parseArgs,
  // Primitives, so a game validates its own events to the same bounds.
  trimmedString,
  roomId,
  username,
  password,
  gameType,
  // The room layer's own events.
  resumeSessionRequest,
  roomCreateRequest,
  gameTypeOnly,
  joinRoomRequest,
  leaveRoomRequest,
  roomIdOnly,
  chatRequest,
};
