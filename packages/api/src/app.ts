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
}

/**
 * Creates and configures the Express application
 *
 * @param config - Application configuration
 * @returns Configured Express application
 */
export function createApp(config: AppConfig): Express {
  const { dataSource, cacheManager, jsonLimit = '10mb', enableCors = true } = config;

  const app: Express = express();

  // --- Core Middleware ---
  if (enableCors) {
    app.use(cors());
  }
  app.use(express.json({ limit: jsonLimit }));
  app.use(loggingMiddleware);

  // --- License Routes (MUST be before license middleware) ---
  app.use('/api/license', createLicenseRouter());

  // --- Apply License Middleware (adds status headers, no blocking) ---
  app.use(licenseMiddleware);

  // --- API Routes (protected by license middleware) ---
  // Apply read-only middleware to routes that should be blocked when license expired
  app.use('/api/teachers', readOnlyMiddleware);
  app.use('/api/subjects', readOnlyMiddleware);
  app.use('/api/classes', readOnlyMiddleware);
  app.use('/api/rooms', readOnlyMiddleware);
  app.use('/api/config', readOnlyMiddleware);
  app.use('/api/timetables', readOnlyMiddleware);

  // Apply generate guard to block generation when trial expired or no license
  app.use('/api/generate', generateGuardMiddleware);

  app.use('/api', createApiRouter(dataSource, cacheManager));

  // --- Error handling middleware ---
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', err, undefined, req.requestContext);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

export default createApp;
