import type { ErrorType } from '../../shared/wire-types.js';

/**
 * An error the server throws internally and then reports to one client. The
 * type it is reported *as* — the payload a `roomError` event carries — is
 * `RoomErrorPayload`, next to `ErrorType` in the shared contract.
 */
interface CustomError extends Error {
  errorType: ErrorType;
}

export type { ErrorType, RoomErrorPayload } from '../../shared/wire-types.js';
export type { CustomError };
