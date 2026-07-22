/** API process bootstrap used by development and the packaged Electron runtime. */

import 'reflect-metadata';
import type { Server } from 'http';
import { AppDataSource, databasePath } from './ormconfig';
import { createApp } from './src/app';
import { DEFAULT_CACHE_MAX_SIZE, DEFAULT_CACHE_TTL_MS } from './src/constants';
import { CacheManager } from './src/database/cache/cacheManager';
import { assertDatabaseIntegrity, backupBeforePendingMigrations } from './src/database/bootstrap';
import { logger } from './src/utils/logger';
import { auditAssignmentStorageConsistency } from './src/services/assignmentConsistency.service';
import { GenerationJobService } from './src/services/generationJob.service';

type ApiProcessMessage =
  | { type: 'api-ready'; host: string; port: number }
  | { type: 'api-error'; message: string };

const requestedPort = process.env.PORT !== undefined ? Number(process.env.PORT) : 4000;
const host = process.env.HOST || '127.0.0.1';
const webDistPath = process.env.WEB_DIST_PATH;
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
let server: Server | null = null;
let shuttingDown = false;

function notifyParent(message: ApiProcessMessage): void {
  if (typeof process.send === 'function') {
    process.send(message);
  }
}

async function shutdown(exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  if (server) {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = null;
  }

  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }

  process.exit(exitCode);
}

async function bootstrap(): Promise<void> {
  try {
    if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65_535) {
      throw new Error(`Invalid API port: ${process.env.PORT}`);
    }

    const backupPath = await backupBeforePendingMigrations(databasePath);
    if (backupPath) logger.info(`Database backup created before migration: ${backupPath}`);

    await AppDataSource.initialize();
    await assertDatabaseIntegrity(AppDataSource);
    await GenerationJobService.getInstance(AppDataSource).recoverInterruptedJobs();
    const assignmentConsistency = await auditAssignmentStorageConsistency(AppDataSource);
    if (assignmentConsistency.isConsistent) {
      logger.info('Assignment compatibility stores are consistent', assignmentConsistency.counts);
    } else {
      const issueCounts = Object.fromEntries(
        Object.entries(assignmentConsistency.issues).map(([key, entries]) => [key, entries.length])
      );
      throw new Error(
        `Assignment semantic integrity check failed: ${JSON.stringify({
          counts: assignmentConsistency.counts,
          issueCounts,
        })}`
      );
    }
    logger.info('Database connection established');

    const cacheManager = new CacheManager({
      defaultConfig: {
        maxSize: DEFAULT_CACHE_MAX_SIZE,
        ttlMs: DEFAULT_CACHE_TTL_MS,
      },
    });

    const expressApp = createApp({
      dataSource: AppDataSource,
      cacheManager,
      enableCors: !webDistPath,
      corsOrigins: corsOrigins.length > 0 ? corsOrigins : undefined,
      webDistPath,
    });

    server = expressApp.listen(requestedPort, host);
    server.once('error', (error) => {
      notifyParent({ type: 'api-error', message: error.message });
      logger.error('API server error', error);
      void shutdown(1);
    });
    server.once('listening', () => {
      const address = server?.address();
      if (!address || typeof address === 'string') {
        const error = new Error('API server did not expose a TCP address');
        notifyParent({ type: 'api-error', message: error.message });
        void shutdown(1);
        return;
      }

      logger.info(`Server is running at http://${host}:${address.port}`);
      notifyParent({ type: 'api-ready', host, port: address.port });
    });
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    notifyParent({ type: 'api-error', message: normalizedError.message });
    logger.error('Failed to start server', normalizedError);
    await shutdown(1);
  }
}

process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());
process.once('disconnect', () => void shutdown());

void bootstrap();
