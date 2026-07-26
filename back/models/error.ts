type ErrorType =
  | 'roomNotExist'
  | 'roomNotOpen'
  | 'incorrectPassword'
  | 'notEnoughPlayers'
  | 'gameAlreadyStarted'
  | 'notRoomOwner'
  // Not an error the UI shows: it is how the room page learns it arrived
  // without a seat, and its cue to ask for one.
  | 'notRoomMember';

interface CustomError extends Error {
  errorType: ErrorType;
}

export type { CustomError, ErrorType };
