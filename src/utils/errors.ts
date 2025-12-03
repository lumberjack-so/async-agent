/**
 * Custom error classes for the async agent
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly cause?: Error;

  constructor(
    message: string,
    statusCode: number,
    isOperational = true,
    cause?: Error
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.cause = cause;

    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, 400, true, cause);
    this.name = 'ValidationError';
  }
}

export class AgentError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, 500, true, cause);
    this.name = 'AgentError';
  }
}

export class StorageError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, 500, true, cause);
    this.name = 'StorageError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, 500, true, cause);
    this.name = 'DatabaseError';
  }
}

export class TimeoutError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, 504, true, cause);
    this.name = 'TimeoutError';
  }
}

export class ConnectionError extends AppError {
  constructor(message: string, cause?: Error) {
    super(message, 503, true, cause);
    this.name = 'ConnectionError';
  }
}

/**
 * Determine if an error is operational (expected) vs programmer error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, 500, false, error);
  }

  return new AppError(String(error), 500, false);
}
