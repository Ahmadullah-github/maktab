import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { DataSource } from 'typeorm';

export const LATEST_DATABASE_MIGRATION = 'DurableGenerationJobs1785200000000';

function isPersistentDatabase(databasePath: string): boolean {
  return databasePath !== ':memory:' && !databasePath.startsWith('file::memory:');
}

function timestampForFileName(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export async function createDatabaseBackup(
  databasePath: string,
  reason = 'backup'
): Promise<string | null> {
  if (!isPersistentDatabase(databasePath)) return null;

  const resolvedPath = path.resolve(databasePath);
  if (!fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).size === 0) return null;

  const database = new Database(resolvedPath, { readonly: true, fileMustExist: true });
  try {
    const integrity = database.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') {
      throw new Error(`Database integrity check failed before backup: ${String(integrity)}`);
    }

    const backupPath = `${resolvedPath}.${reason}-${timestampForFileName()}`;
    await database.backup(backupPath);
    return backupPath;
  } finally {
    database.close();
  }
}

/**
 * Back up an existing database before TypeORM applies a pending managed migration.
 * The SQLite backup API remains consistent if the source database uses WAL mode.
 */
export async function backupBeforePendingMigrations(
  databasePath: string,
  latestMigrationName = LATEST_DATABASE_MIGRATION
): Promise<string | null> {
  if (!isPersistentDatabase(databasePath)) return null;

  const resolvedPath = path.resolve(databasePath);
  if (!fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).size === 0) return null;

  const database = new Database(resolvedPath, { readonly: true, fileMustExist: true });
  try {
    const integrity = database.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') {
      throw new Error(`Database integrity check failed before migration: ${String(integrity)}`);
    }

    const hasMigrationTable = Boolean(
      database
        .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'migrations' LIMIT 1`)
        .get()
    );
    if (hasMigrationTable) {
      const latestApplied = database
        .prepare(`SELECT 1 FROM migrations WHERE name = ? LIMIT 1`)
        .get(latestMigrationName);
      if (latestApplied) return null;
    }

    return createDatabaseBackup(resolvedPath, 'backup');
  } finally {
    database.close();
  }
}

/** Fail startup if a migration left SQLite or any declared foreign key inconsistent. */
export async function assertDatabaseIntegrity(dataSource: DataSource): Promise<void> {
  const integrityRows = (await dataSource.query('PRAGMA integrity_check')) as Array<{
    integrity_check: string;
  }>;
  const integrityFailures = integrityRows
    .map((row) => row.integrity_check)
    .filter((result) => result !== 'ok');

  const foreignKeyFailures = (await dataSource.query('PRAGMA foreign_key_check')) as unknown[];
  if (integrityFailures.length > 0 || foreignKeyFailures.length > 0) {
    throw new Error(
      `Database verification failed after migration (integrity=${integrityFailures.join(', ') || 'ok'}, foreignKeys=${foreignKeyFailures.length})`
    );
  }
}
