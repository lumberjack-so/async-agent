/**
 * Security middleware for input sanitization and validation
 */

import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors.js';
import { logger, getCorrelationId } from './logging.js';

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Validate request ID format
 */
export function validateRequestId(requestId: string): void {
  if (!REQUEST_ID_PATTERN.test(requestId)) {
    throw new ValidationError(
      'Request ID contains invalid characters. Only alphanumeric, underscore, and hyphen allowed.'
    );
  }

  if (requestId.length > 100) {
    throw new ValidationError('Request ID exceeds maximum length of 100 characters');
  }

  if (requestId.includes('..') || requestId.includes('/') || requestId.includes('\\')) {
    throw new ValidationError('Request ID contains invalid path characters');
  }
}

/**
 * Sanitize filename before storage
 */
export function sanitizeFilename(filename: string): string {
  let sanitized = filename.replace(/^.*[/\\]/, '');
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');

  if (sanitized.startsWith('.')) {
    sanitized = sanitized.substring(1);
  }

  if (!sanitized || sanitized.length === 0) {
    sanitized = `file_${Date.now()}`;
  }

  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop();
    const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf('.'));
    sanitized =
      nameWithoutExt.substring(0, 250 - (ext?.length || 0)) + (ext ? `.${ext}` : '');
  }

  return sanitized;
}

/**
 * Security validation middleware
 */
export function securityMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const correlationId = getCorrelationId(req);

  try {
    if (req.body?.requestId) {
      validateRequestId(req.body.requestId);
    }

    logger.debug(correlationId, 'security', 'Security validation passed');
    next();
  } catch (error) {
    logger.warn(correlationId, 'security', 'Security validation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

/**
 * Set security headers
 */
export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'");

  next();
}

/**
 * Simple in-memory rate limiter
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 60, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    setInterval(() => this.cleanup(), 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [ip, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter((t) => now - t < this.windowMs);
      if (validTimestamps.length === 0) {
        this.requests.delete(ip);
      } else {
        this.requests.set(ip, validTimestamps);
      }
    }
  }

  check(ip: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(ip) || [];
    const validTimestamps = timestamps.filter((t) => now - t < this.windowMs);

    if (validTimestamps.length >= this.maxRequests) {
      return false;
    }

    validTimestamps.push(now);
    this.requests.set(ip, validTimestamps);
    return true;
  }

  getRemainingRequests(ip: string): number {
    const now = Date.now();
    const timestamps = this.requests.get(ip) || [];
    const validTimestamps = timestamps.filter((t) => now - t < this.windowMs);
    return Math.max(0, this.maxRequests - validTimestamps.length);
  }
}

const rateLimiter = new RateLimiter(
  parseInt(process.env.RATE_LIMIT_MAX || '60', 10),
  parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10)
);

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const correlationId = getCorrelationId(req);
  const ip = req.ip || 'unknown';

  if (!rateLimiter.check(ip)) {
    logger.warn(correlationId, 'security', 'Rate limit exceeded', { ip });

    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: 60,
    });
    return;
  }

  const remaining = rateLimiter.getRemainingRequests(ip);
  res.setHeader('X-RateLimit-Remaining', remaining.toString());
  res.setHeader('X-RateLimit-Limit', process.env.RATE_LIMIT_MAX || '60');

  next();
}
