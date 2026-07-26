type ErrorType =
    | 'roomNotExist'
    | 'roomNotOpen'
    | 'incorrectPassword'
    | 'notEnoughPlayers'
    | 'gameAlreadyStarted';

interface CustomError extends Error {
    errorType: ErrorType;
}

export type { CustomError, ErrorType };
