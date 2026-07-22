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
import { CacheManager } from './database/cache/cacheManager';
import {
  generateGuardMiddleware,
  licenseMiddleware,
  readOnlyMiddleware,
} from './middleware/licenseMiddleware';
import { loggingMiddleware } from './middleware/logging.middleware';
import { createApiRouter, createLicenseRouter } from './routes';
import { logger } from './utils/logger';
import { createOperationIssue, createOperationResponse } from './types/operation.types';

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
  app.use(loggingMiddleware);
  app.use(express.json({ limit: jsonLimit }));

  // --- License Routes (MUST be before license middleware) ---
  app.use('/api/license', createLicenseRouter());

  // --- Apply License Middleware (adds status headers, no blocking) ---
  app.use(licenseMiddleware);

  // --- API Routes (protected by license middleware) ---
  // Apply read-only middleware to routes that should be blocked when license expired
  app.use('/api/teachers', readOnlyMiddleware);
  app.use('/api/subjects', readOnlyMiddleware);
  app.use('/api/curriculum', readOnlyMiddleware);
  app.use('/api/classes', readOnlyMiddleware);
  app.use('/api/rooms', readOnlyMiddleware);
  app.use('/api/config', readOnlyMiddleware);
  app.use('/api/timetables', readOnlyMiddleware);

  // Apply generate guard to block generation when trial expired or no license
  app.use('/api/generate', generateGuardMiddleware);

  app.use('/api', createApiRouter(dataSource, cacheManager));

  if (webDistPath) {
    app.use(express.static(webDistPath));
    app.use((req: Request, res: Response, next: NextFunction) => {
      const acceptsHtml = req.accepts('html');
      if (req.method === 'GET' && !req.path.startsWith('/api') && acceptsHtml) {
        res.sendFile(path.join(webDistPath, 'index.html'));
        return;
      }
      next();
    });
  }

  // --- Error handling middleware ---
  app.use((err: Error & { status?: number }, req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', err, undefined, req.requestContext);
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    if (req.path.startsWith('/api/generate')) {
      const code = status === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR';
      res.status(status).json(
        createOperationResponse('failed', req.requestContext?.requestId ?? 'untracked', {
          issues: [createOperationIssue(code, 'request')],
        })
      );
      return;
    }
    res.status(status).json({ error: status === 403 ? 'Forbidden' : 'Internal server error' });
  });

  return app;
}

export default createApp;
