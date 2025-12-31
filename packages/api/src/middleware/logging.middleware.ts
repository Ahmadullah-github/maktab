/**
 * Request logging middleware for structured HTTP request/response logging
 * @module middleware/logging
 * 
 * Requirements: 10.5
 * - Log request method, path, status code, and duration
 * - Use structured logger from utils
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger } from '../utils/logger';
import { RequestContext } from '../types/common.types';
import { randomUUID } from 'crypto';

/**
 * Extends Express Request to include request context
 */
declare global {
  namespace Express {
    interface Request {
      requestContext?: RequestContext;
    }
  }
}

/**
 * Middleware that logs HTTP requests with timing information
 * 
 * Logs:
 * - Request method (GET, POST, etc.)
 * - Request path
 * - Response status code
 * - Request duration in milliseconds
 * 
 * @example
 * ```typescript
 * app.use(loggingMiddleware);
 * ```
 */
export const loggingMiddleware: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();
  const requestId = randomUUID();
  
  // Attach request context for use by other middleware/handlers
  req.requestContext = {
    requestId,
    method: req.method,
    path: req.path,
  };
  
  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.request(
      req.method,
      req.path,
      res.statusCode,
      duration,
      req.requestContext
    );
  });
  
  next();
};

/**
 * Creates a logging middleware with custom options
 * 
 * @param options - Configuration options
 * @returns Configured logging middleware
 */
export function createLoggingMiddleware(options: {
  /** Skip logging for certain paths (e.g., health checks) */
  skipPaths?: string[];
  /** Include query parameters in logs */
  includeQuery?: boolean;
}): RequestHandler {
  const { skipPaths = [], includeQuery = false } = options;
  
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip logging for specified paths
    if (skipPaths.includes(req.path)) {
      return next();
    }
    
    const startTime = Date.now();
    const requestId = randomUUID();
    
    // Build path with optional query string
    const logPath = includeQuery && Object.keys(req.query).length > 0
      ? `${req.path}?${new URLSearchParams(req.query as Record<string, string>).toString()}`
      : req.path;
    
    // Attach request context
    req.requestContext = {
      requestId,
      method: req.method,
      path: logPath,
    };
    
    // Log when response finishes
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      logger.request(
        req.method,
        logPath,
        res.statusCode,
        duration,
        req.requestContext
      );
    });
    
    next();
  };
}
