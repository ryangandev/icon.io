type ErrorType =
    | 'roomNotExist'
    | 'roomNotOpen'
    | 'incorrectPassword'
    | 'notEnoughPlayers';

interface CustomError extends Error {
    errorType: ErrorType;
}

export type { CustomError };
