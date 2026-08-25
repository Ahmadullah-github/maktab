/**
 * Express application configuration
 * @module app
 *
 * Requirements: 2.1
 * - Application setup, middleware registration, and route mounting
 * - Separates app configuration from server bootstrap
 */

import cors from 'cors';
import express, { Express, NextFunction, Request, Response } from 'express';
import path from 'path';
import { DataSource } from 'typeorm';
import { LOCAL_API_PREFIX } from './constants';
import { CacheManager } from './database/cache/cacheManager';
import {
  createErrorResponse,
  errorEnvelopeMiddleware,
  LocalApiError,
} from './errors/localApiError';
import {
  generateGuardMiddleware,
  licenseMiddleware,
} from './middleware/licenseMiddleware';
import { loggingMiddleware } from './middleware/logging.middleware';
import { createLocalApiAuthMiddleware } from './middleware/localApiAuth.middleware';
import { createApiRouter, createLicenseRouter } from './routes';
import { DESKTOP_CONTENT_SECURITY_POLICY, DESKTOP_PERMISSIONS_POLICY } from './securityHeaders';
import { logger } from './utils/logger';

/**
 * Configuration options for creating the Express app
 */
export interface AppConfig {
  /** TypeORM DataSource for database operations */
  dataSource: DataSource;
  /** Optional CacheManager for caching */
  cacheManager?: CacheManager;
  /** JSON body size limit (default: '10mb') */
  jsonLimit?: string;
  /** Enable CORS (default: true) */
  enableCors?: boolean;
  /** Exact development origins allowed to call the API directly. */
  corsOrigins?: string[];
  /** Built renderer assets to serve in the packaged desktop runtime. */
  webDistPath?: string;
  /** Per-process secret required on local API requests. Mandatory in production. */
  sessionToken?: string;
  /** Component compatibility data exposed by the authenticated readiness endpoint. */
  readiness?: Record<string, unknown>;
}

/**
 * Creates and configures the Express application
 *
 * @param config - Application configuration
 * @returns Configured Express application
 */
export function createApp(config: AppConfig): Express {
  const {
    dataSource,
    cacheManager,
    jsonLimit = '10mb',
    enableCors = true,
    corsOrigins = ['http://127.0.0.1:5173', 'http://localhost:5173'],
    webDistPath,
    sessionToken,
    readiness,
  } = config;

  const app: Express = express();

  // --- Core Middleware ---
  if (enableCors) {
    const allowedOrigins = new Set(corsOrigins);
    app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin || allowedOrigins.has(origin)) {
            callback(null, true);
            return;
          }

          const error = new Error('CORS origin denied') as Error & { status?: number };
          error.status = 403;
          callback(error);
        },
      })
    );
  }
  app.use(express.json({ limit: jsonLimit }));
  app.use(loggingMiddleware);
  app.use(errorEnvelopeMiddleware);
  app.use(createLocalApiAuthMiddleware(sessionToken));
  app.locals.readiness = readiness;

  if (webDistPath) {
    app.use((_req, res, next) => {
      res.setHeader(
        'Content-Security-Policy',
        DESKTOP_CONTENT_SECURITY_POLICY
      );
      res.setHeader('Permissions-Policy', DESKTOP_PERMISSIONS_POLICY);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Referrer-Policy', 'no-referrer');
      next();
    });
  }

  // Signed lease state is added to every API response. It blocks only POST /generate.
  app.use(licenseMiddleware);
  app.use(`${LOCAL_API_PREFIX}/license`, createLicenseRouter());

  // --- API Routes (protected by license middleware) ---
  // Expiry never blocks access to data; only new generation is licensed.
  app.use(`${LOCAL_API_PREFIX}/generate`, generateGuardMiddleware);

  app.use(LOCAL_API_PREFIX, createApiRouter(dataSource, cacheManager));

  app.use(LOCAL_API_PREFIX, (req: Request, res: Response) => {
    res.status(404).json(
      createErrorResponse(
        req,
        404,
        'NOT_FOUND',
        `Local API route not found: ${req.method} ${req.path}`
      )
    );
  });

  if (webDistPath) {
    app.use(express.static(webDistPath));
    app.use((req: Request, res: Response, next: NextFunction) => {
      const acceptsHtml = req.accepts('html');
      if (req.method === 'GET' && !req.path.startsWith(LOCAL_API_PREFIX) && acceptsHtml) {
        res.sendFile(path.join(webDistPath, 'index.html'));
        return;
      }
      next();
    });
  }

  // --- Error handling middleware ---
  app.use((err: Error & { status?: number }, req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', err, undefined, req.requestContext);
    const localError = err instanceof LocalApiError ? err : null;
    const status = localError?.status ??
      (err.status && err.status >= 400 && err.status < 600 ? err.status : 500);
    const fallbackCode = status === 400
      ? 'VALIDATION_ERROR'
      : status === 403
        ? 'FORBIDDEN'
        : status === 404
          ? 'NOT_FOUND'
          : status === 413
            ? 'REQUEST_TOO_LARGE'
            : 'INTERNAL_ERROR';
    res.status(status).json(
      createErrorResponse(
        req,
        status,
        localError?.code ?? fallbackCode,
        localError?.message ?? (status === 403 ? 'Forbidden' : 'Internal server error'),
        localError?.details,
        localError?.retryable ?? false
      )
    );
  });

  return app;
}

export default createApp;
