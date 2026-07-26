type ErrorType =
  | 'roomNotExist'
  | 'roomNotOpen'
  | 'incorrectPassword'
  | 'notEnoughPlayers'
  | 'gameAlreadyStarted'
  | 'notRoomOwner'
  | 'notRoomMember';

interface CustomError extends Error {
  errorType: ErrorType;
}

export type { CustomError, ErrorType };
