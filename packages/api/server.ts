/**
 * Server bootstrap - entry point for the API server
 * @module server
 * 
 * Requirements: 2.1
 * - Application setup, middleware registration, and route mounting
 * - Target: under 50 lines (bootstrap only)
 */

import 'reflect-metadata';
import { AppDataSource } from './ormconfig';
import { createApp } from './src/app';
import { CacheManager } from './src/database/cache/cacheManager';
import { logger } from './src/utils/logger';
import { DEFAULT_CACHE_MAX_SIZE, DEFAULT_CACHE_TTL_MS } from './src/constants';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const HOST = process.env.HOST || '0.0.0.0';

/**
 * Initialize and start the server
 */
async function bootstrap(): Promise<void> {
  try {
    // Initialize TypeORM DataSource
    await AppDataSource.initialize();
    logger.info('Database connection established');

    // Create cache manager with default configuration
    const cacheManager = new CacheManager({
      defaultConfig: {
        maxSize: DEFAULT_CACHE_MAX_SIZE,
        ttlMs: DEFAULT_CACHE_TTL_MS,
      },
    });

    // Create and configure Express app
    const app = createApp({
      dataSource: AppDataSource,
      cacheManager,
    });

    // Start the server
    app.listen(PORT, HOST, () => {
      logger.info(`Server is running at http://${HOST}:${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

// Start the server
bootstrap();
