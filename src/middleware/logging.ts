/**
 * Logging middleware with correlation ID support
 */

import { Request, Response, NextFunction } from 'express';

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

class Logger {
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private formatLog(
    level: LogLevel,
    correlationId: string,
    module: string,
    message: string,
    data?: any
  ): string {
    const baseLog = `[${this.getTimestamp()}] [${level}] [${correlationId}] [${module}] ${message}`;

    if (data) {
      return `${baseLog} ${JSON.stringify(data)}`;
    }

    return baseLog;
  }

  log(
    level: LogLevel,
    correlationId: string,
    module: string,
    message: string,
    data?: any
  ): void {
    const logMessage = this.formatLog(level, correlationId, module, message, data);

    switch (level) {
      case LogLevel.ERROR:
        console.error(logMessage);
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      case LogLevel.INFO:
      case LogLevel.DEBUG:
      default:
        console.log(logMessage);
        break;
    }
  }

  error(correlationId: string, module: string, message: string, data?: any): void {
    this.log(LogLevel.ERROR, correlationId, module, message, data);
  }

  warn(correlationId: string, module: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, correlationId, module, message, data);
  }

  info(correlationId: string, module: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, correlationId, module, message, data);
  }

  debug(correlationId: string, module: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, correlationId, module, message, data);
  }
}

export const logger = new Logger();

/**
 * Request/response logging middleware
 */
export function loggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const correlationId =
    req.body?.requestId ||
    `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  req.correlationId = correlationId;
  req.startTime = Date.now();

  logger.info(correlationId, 'http', `Request received: ${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  const originalSend = res.send;
  res.send = function (data: any): Response {
    const duration = req.startTime
      ? ((Date.now() - req.startTime) / 1000).toFixed(2)
      : 'unknown';

    logger.info(correlationId, 'http', `Response sent: ${res.statusCode}`, {
      statusCode: res.statusCode,
      duration: `${duration}s`,
    });

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Get correlation ID from request
 */
export function getCorrelationId(req: Request): string {
  return req.correlationId || 'unknown';
}
