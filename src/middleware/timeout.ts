/**
 * Request timeout middleware
 */

import { Request, Response, NextFunction } from 'express';
import { TimeoutError } from '../utils/errors.js';
import { logger, getCorrelationId } from './logging.js';
import { cleanupTempDirectory } from '../files.js';

const TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '360000', 10); // 6 minutes default

/**
 * Timeout middleware - aborts requests that take too long
 */
export function timeoutMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const correlationId = getCorrelationId(req);

  const timeoutId = setTimeout(() => {
    if (!res.headersSent) {
      logger.error(correlationId, 'timeout', 'Request timeout exceeded', {
        duration: `${TIMEOUT_MS / 1000}s`,
        path: req.path,
      });

      if (req.body?.requestId) {
        cleanupTempDirectory(req.body.requestId).catch((err) => {
          logger.warn(
            correlationId,
            'timeout',
            'Failed to cleanup temp directory during timeout',
            { error: err.message }
          );
        });
      }

      res.status(504).json({
        error: 'Request timeout',
        message: 'The request took too long to process',
        requestId: req.body?.requestId,
        correlationId,
      });
    }
  }, TIMEOUT_MS);

  res.on('finish', () => {
    clearTimeout(timeoutId);
  });

  res.on('close', () => {
    clearTimeout(timeoutId);
  });

  next();
}

/**
 * Execute async function with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new TimeoutError(errorMessage)), timeoutMs)
    ),
  ]);
}
