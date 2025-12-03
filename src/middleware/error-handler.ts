/**
 * Centralized error handling middleware
 */

import { Request, Response, NextFunction } from 'express';
import { AppError, isOperationalError } from '../utils/errors.js';
import { logger, getCorrelationId } from './logging.js';
import { cleanupTempDirectory } from '../files.js';

interface ErrorResponse {
  error: string;
  message: string;
  correlationId: string;
  requestId?: string;
  details?: any;
  stack?: string;
}

/**
 * Error handler middleware - must be last in middleware chain
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const correlationId = getCorrelationId(req);
  const requestId = req.body?.requestId;

  let statusCode = 500;
  let message = 'An unexpected error occurred';
  let errorName = 'InternalError';
  let details: any = undefined;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    errorName = error.name;

    if (error.cause) {
      details = {
        cause: error.cause.message,
        stack: error.cause.stack,
      };
    }
  } else {
    message = error.message || message;
    errorName = error.name || errorName;
  }

  const logData: any = {
    name: errorName,
    message,
    statusCode,
    path: req.path,
    method: req.method,
  };

  if (requestId) {
    logData.requestId = requestId;
  }

  if (details) {
    logData.details = details;
  }

  if (statusCode >= 500) {
    logger.error(correlationId, 'error', `${errorName}: ${message}`, logData);
    if (error.stack) {
      logger.error(correlationId, 'error', 'Stack trace', { stack: error.stack });
    }
  } else if (statusCode >= 400) {
    logger.warn(correlationId, 'error', `${errorName}: ${message}`, logData);
  } else {
    logger.info(correlationId, 'error', `${errorName}: ${message}`, logData);
  }

  if (requestId) {
    cleanupTempDirectory(requestId).catch((cleanupErr) => {
      logger.warn(
        correlationId,
        'cleanup',
        'Failed to cleanup temp directory after error',
        { error: cleanupErr.message }
      );
    });
  }

  const errorResponse: ErrorResponse = {
    error: errorName,
    message,
    correlationId,
  };

  if (requestId) {
    errorResponse.requestId = requestId;
  }

  if (statusCode >= 400 && statusCode < 500 && details) {
    errorResponse.details = details;
  }

  if (process.env.NODE_ENV === 'development' && error.stack) {
    errorResponse.stack = error.stack;
  }

  if (!res.headersSent) {
    res.status(statusCode).json(errorResponse);
  }

  if (!isOperationalError(error)) {
    logger.error(
      correlationId,
      'error',
      'Non-operational error detected - this may indicate a programming bug',
      { error: errorName, message }
    );
  }
}

/**
 * Handle 404 errors
 */
export function notFoundHandler(req: Request, res: Response): void {
  const correlationId = getCorrelationId(req);

  logger.warn(correlationId, 'http', 'Route not found', {
    method: req.method,
    path: req.path,
  });

  res.status(404).json({
    error: 'NotFound',
    message: `Route ${req.method} ${req.path} not found`,
    correlationId,
  });
}

/**
 * Wrap async route handlers to catch errors
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
