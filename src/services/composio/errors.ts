/**
 * Composio Error Classes
 *
 * Custom error types for Composio integration with retry logic
 */

import { AppError } from '../../utils/errors.js';

export class ComposioError extends AppError {
  constructor(message: string, statusCode: number = 500) {
    super(message, statusCode);
    this.name = 'ComposioError';
  }
}

export class ComposioAuthError extends ComposioError {
  constructor(message: string) {
    super(message, 401);
    this.name = 'ComposioAuthError';
  }
}

export class ComposioConnectionError extends ComposioError {
  constructor(message: string) {
    super(message, 503);
    this.name = 'ComposioConnectionError';
  }
}

export class ComposioConfigError extends ComposioError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'ComposioConfigError';
  }
}

/**
 * Execute a function with retry logic
 */
export async function withComposioRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on auth errors
      if (error instanceof ComposioAuthError) {
        throw error;
      }

      // Wait before retry
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
      }
    }
  }

  throw lastError!;
}
