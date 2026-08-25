/** API process bootstrap used by development and the packaged Electron runtime. */

import 'reflect-metadata';
import type { Server } from 'http';
import path from 'path';
import { AppDataSource, databasePath } from './ormconfig';
import { createApp } from './src/app';
import { DEFAULT_CACHE_MAX_SIZE, DEFAULT_CACHE_TTL_MS } from './src/constants';
import { CacheManager } from './src/database/cache/cacheManager';
import { assertDatabaseIntegrity, runDatabaseUpgrade } from './src/database/bootstrap';
import { logger } from './src/utils/logger';
import { auditAssignmentStorageConsistency } from './src/services/assignmentConsistency.service';

type ApiProcessMessage =
  | { type: 'api-startup-progress'; stage: 'backup' | 'migration' | 'integrity' | 'solver' | 'listening' }
  | { type: 'api-ready'; protocolVersion: 1; host: string; port: number; pid: number; buildId: string; dbSchema: number; solver: { version: string; sha256: string } }
  | { type: 'api-error'; message: string };

type ApiParentMessage = { type: 'api-shutdown' };
type ElectronParentPort = {
  postMessage(message: ApiProcessMessage): void;
  on(event: 'message', listener: (event: { data?: unknown } | unknown) => void): void;
};

const requestedPort = process.env.PORT !== undefined ? Number(process.env.PORT) : 4000;
const host = process.env.HOST || '127.0.0.1';
const webDistPath = process.env.WEB_DIST_PATH;
const sessionToken = process.env.LOCAL_API_SESSION_TOKEN;
const buildId = process.env.MAKTAB_BUILD_ID || 'development';
const appVersion = process.env.MAKTAB_APP_VERSION || 'development';
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
let server: Server | null = null;
let shuttingDown = false;
const parentPort = (process as NodeJS.Process & { parentPort?: ElectronParentPort }).parentPort;

function notifyParent(message: ApiProcessMessage): void {
  if (parentPort) {
    parentPort.postMessage(message);
  } else if (typeof process.send === 'function') {
    process.send(message);
  }
}

function readParentMessage(event: { data?: unknown } | unknown): ApiParentMessage | null {
  const candidate = event && typeof event === 'object' && 'data' in event
    ? (event as { data?: unknown }).data
    : event;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  const record = candidate as Record<string, unknown>;
  return Object.keys(record).length === 1 && record.type === 'api-shutdown'
    ? { type: 'api-shutdown' }
    : null;
}

async function shutdown(exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  const { SolverService } = await import('./src/services/solver.service');
  SolverService.getInstance().shutdown();

  if (server) {
    server.closeIdleConnections?.();
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

    const recoveryDirectory = process.env.MAKTAB_RECOVERY_DIRECTORY ||
      path.join(path.dirname(path.resolve(databasePath)), 'recovery');
    const upgrade = await runDatabaseUpgrade({
      dataSource: AppDataSource,
      databasePath,
      recoveryDirectory,
      onStage: (stage) => notifyParent({ type: 'api-startup-progress', stage }),
      verify: async (dataSource) => {
        await assertDatabaseIntegrity(dataSource);
        const assignmentConsistency = await auditAssignmentStorageConsistency(dataSource);
        if (assignmentConsistency.isConsistent) {
          logger.info('Canonical assignment storage is consistent', assignmentConsistency.counts);
          return;
        }
        throw new Error(
          `Assignment semantic integrity check failed: ${JSON.stringify({
            counts: assignmentConsistency.counts,
            issues: assignmentConsistency.issues,
          })}`
        );
      },
    });
    if (upgrade.backupPath) {
      logger.info(`Database backup created before migration: ${upgrade.backupPath}`);
    }
    logger.info('Database connection established');
    const dbSchema = upgrade.schema.ordinal;

    notifyParent({ type: 'api-startup-progress', stage: 'solver' });
    const { SolverService } = await import('./src/services/solver.service');
    const solver = await SolverService.getInstance().preflight();

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
      sessionToken,
      readiness: {
        buildId,
        appVersion,
        database: {
          status: 'ok',
          schemaVersion: dbSchema,
          schema: {
            migrationId: upgrade.schema.id,
            migrationName: upgrade.schema.name,
            ordinal: upgrade.schema.ordinal,
          },
          integrity: 'ok',
        },
        solver: { status: 'ok', ...solver },
        licenseVerifier: (() => {
          try {
            const keys = Object.keys(JSON.parse(process.env.MAKTAB_LICENSE_PUBLIC_KEYS || '{}'));
            return { status: keys.length ? 'ok' : 'unconfigured', keyId: keys.join(',') || null };
          } catch {
            return { status: 'unconfigured', keyId: null };
          }
        })(),
      },
    });

    const listeningServer = expressApp.listen(requestedPort, host);
    server = listeningServer;
    listeningServer.once('error', (error) => {
      notifyParent({ type: 'api-error', message: error.message });
      logger.error('API server error', error);
      void shutdown(1);
    });
    listeningServer.once('listening', () => {
      const address = listeningServer.address();
      if (!address || typeof address === 'string') {
        const error = new Error('API server did not expose a TCP address');
        notifyParent({ type: 'api-error', message: error.message });
        void shutdown(1);
        return;
      }

      logger.info(`Server is running at http://${host}:${address.port}`);
      notifyParent({ type: 'api-startup-progress', stage: 'listening' });
      notifyParent({ type: 'api-ready', protocolVersion: 1, host, port: address.port, pid: process.pid, buildId, dbSchema, solver });
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
parentPort?.on('message', (event) => {
  if (readParentMessage(event)?.type === 'api-shutdown') void shutdown();
});

void bootstrap();
