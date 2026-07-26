import type { ErrorType, RoomErrorPayload } from '../../shared/wire-types.js';

/**
 * An error the server throws internally and then reports to one client. The
 * type it is reported *as* — the payload a `roomError` event carries — is
 * `RoomErrorPayload`, next to `ErrorType` in the shared contract.
 */
interface CustomError extends Error {
  errorType: ErrorType;
}

const isCustomError = (error: unknown): error is CustomError =>
  error instanceof Error &&
  typeof (error as CustomError).errorType === 'string';

/**
 * Turns whatever was thrown into the payload a client can be told about.
 *
 * A `catch` binding is `unknown`, and it is not always one of ours: a bug in a
 * handler throws a `TypeError` down the same path. That used to reach the
 * client as an errorType of `undefined`, which matches no branch, so the page
 * sat there having been told nothing. Anything unrecognised is reported as
 * `roomNotExist` instead — the join did not happen, so sending them back to the
 * lobby is the recoverable outcome — with a message that gives nothing away.
 */
const asRoomError = (error: unknown): RoomErrorPayload => ({
  status: true,
  message: isCustomError(error) ? error.message : 'Something went wrong.',
  errorType: isCustomError(error) ? error.errorType : 'roomNotExist',
});

export { asRoomError, isCustomError };
export type { ErrorType, RoomErrorPayload } from '../../shared/wire-types.js';
export type { CustomError };
