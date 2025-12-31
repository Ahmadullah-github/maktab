/**
 * Express application configuration
 * @module app
 * 
 * Requirements: 2.1
 * - Application setup, middleware registration, and route mounting
 * - Separates app configuration from server bootstrap
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { DataSource } from 'typeorm';
import { createApiRouter, createLicenseRouter } from './routes';
import { licenseMiddleware } from './middleware/licenseMiddleware';
import { loggingMiddleware } from './middleware/logging.middleware';
import { CacheManager } from './database/cache/cacheManager';
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
  const { 
    dataSource, 
    cacheManager, 
    jsonLimit = '10mb',
    enableCors = true 
  } = config;

  const app: Express = express();

  // --- Core Middleware ---
  if (enableCors) {
    app.use(cors());
  }
  app.use(express.json({ limit: jsonLimit }));
  app.use(loggingMiddleware);

  // --- License Routes (MUST be before license middleware) ---
  app.use('/api/license', createLicenseRouter());

  // --- Apply License Middleware (blocks expired licenses) ---
  app.use(licenseMiddleware);

  // --- API Routes (protected by license middleware) ---
  app.use('/api', createApiRouter(dataSource, cacheManager));

  // --- Error handling middleware ---
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', err, undefined, req.requestContext);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

export default createApp;
