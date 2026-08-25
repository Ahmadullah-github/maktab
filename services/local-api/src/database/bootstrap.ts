import crypto from 'crypto';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { DataSource } from 'typeorm';
import {
  LATEST_DATABASE_MIGRATION as LATEST_MIGRATION,
  MIGRATION_REGISTRY,
  migrationByName,
} from './migrationRegistry';

export const LATEST_DATABASE_MIGRATION = LATEST_MIGRATION.name;
const BACKUP_RETENTION_MS = 30 * 86_400_000;
const MINIMUM_RETAINED_BACKUPS = 3;

export interface DatabaseSchemaIdentity {
  id: number;
  name: string;
  ordinal: number;
}

interface AppliedMigration {
  timestamp: number;
  name: string;
}

interface UpgradeJournal {
  formatVersion: 1;
  operationId: string;
  status: 'prepared' | 'migrating' | 'verifying' | 'committed' | 'rolled_back';
  databasePath: string;
  backupPath: string;
  backupSha256: string;
  target: DatabaseSchemaIdentity;
  createdAt: string;
  updatedAt: string;
  failure?: string;
}

export interface DatabaseUpgradeOptions {
  dataSource: DataSource;
  databasePath: string;
  recoveryDirectory: string;
  verify: (dataSource: DataSource) => Promise<void>;
  onStage?: (stage: 'backup' | 'migration' | 'integrity') => void;
}

export interface DatabaseUpgradeResult {
  backupPath: string | null;
  schema: DatabaseSchemaIdentity;
}

function isPersistentDatabase(databasePath: string): boolean {
  return databasePath !== ':memory:' && !databasePath.startsWith('file::memory:');
}

function timestampForFileName(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function sha256File(filePath: string): string {
  const hash = crypto.createHash('sha256');
  const descriptor = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest('hex');
}

function flushDirectory(directory: string): void {
  try {
    const descriptor = fs.openSync(directory, 'r');
    try {
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
  } catch {
    // Directory fsync is not supported on every Windows filesystem.
  }
}

function writeJsonDurably(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${crypto.randomUUID()}.tmp`;
  const descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  fs.renameSync(temporaryPath, filePath);
  flushDirectory(path.dirname(filePath));
}

function journalPath(recoveryDirectory: string, databasePath: string): string {
  return path.join(recoveryDirectory, `${path.basename(databasePath)}.upgrade-journal.json`);
}

function updateJournal(
  filePath: string,
  journal: UpgradeJournal,
  update: Partial<UpgradeJournal>
): UpgradeJournal {
  const next = { ...journal, ...update, updatedAt: new Date().toISOString() };
  writeJsonDurably(filePath, next);
  return next;
}

function validateDatabaseFile(filePath: string): void {
  const database = new Database(filePath, { readonly: true, fileMustExist: true });
  try {
    const integrity = database.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') throw new Error(`Database integrity check failed: ${String(integrity)}`);
    const foreignKeyFailures = database.pragma('foreign_key_check') as unknown[];
    if (foreignKeyFailures.length > 0) {
      throw new Error(`Database foreign-key check failed (${foreignKeyFailures.length} rows)`);
    }
  } finally {
    database.close();
  }
}

function copyFileDurably(source: string, destination: string): void {
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
  const descriptor = fs.openSync(destination, 'r');
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function restoreUpgradeBackup(journal: UpgradeJournal, recoveryDirectory: string): void {
  if (!fs.existsSync(journal.backupPath)) {
    throw new Error(`Automatic migration backup is missing: ${journal.backupPath}`);
  }
  if (sha256File(journal.backupPath) !== journal.backupSha256) {
    throw new Error('Automatic migration backup hash does not match its recovery journal');
  }
  validateDatabaseFile(journal.backupPath);

  const restorePath = `${journal.databasePath}.${journal.operationId}.restore`;
  fs.rmSync(restorePath, { force: true });
  copyFileDurably(journal.backupPath, restorePath);

  for (const suffix of ['-wal', '-shm']) fs.rmSync(`${journal.databasePath}${suffix}`, { force: true });
  if (fs.existsSync(journal.databasePath)) {
    const failedPath = path.join(
      recoveryDirectory,
      `${path.basename(journal.databasePath)}.failed-${timestampForFileName()}.db`
    );
    fs.renameSync(journal.databasePath, failedPath);
  }
  fs.renameSync(restorePath, journal.databasePath);
  flushDirectory(path.dirname(journal.databasePath));
  if (sha256File(journal.databasePath) !== journal.backupSha256) {
    throw new Error('Restored database hash does not match the automatic migration backup');
  }
  validateDatabaseFile(journal.databasePath);
}

function readUpgradeJournal(filePath: string): UpgradeJournal | null {
  if (!fs.existsSync(filePath)) return null;
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<UpgradeJournal>;
  if (
    parsed.formatVersion !== 1 ||
    typeof parsed.operationId !== 'string' ||
    typeof parsed.databasePath !== 'string' ||
    typeof parsed.backupPath !== 'string' ||
    typeof parsed.backupSha256 !== 'string' ||
    !parsed.target ||
    typeof parsed.status !== 'string'
  ) {
    throw new Error('Database upgrade recovery journal is invalid');
  }
  return parsed as UpgradeJournal;
}

export function reconcileInterruptedDatabaseUpgrade(
  databasePath: string,
  recoveryDirectory: string
): void {
  if (!isPersistentDatabase(databasePath)) return;
  const filePath = journalPath(recoveryDirectory, path.resolve(databasePath));
  const journal = readUpgradeJournal(filePath);
  if (!journal || journal.status === 'committed' || journal.status === 'rolled_back') return;
  if (path.resolve(journal.databasePath) !== path.resolve(databasePath)) {
    throw new Error('Database upgrade journal targets another database');
  }
  restoreUpgradeBackup(journal, recoveryDirectory);
  updateJournal(filePath, journal, {
    status: 'rolled_back',
    failure: 'Recovered an interrupted database upgrade before startup',
  });
}

function readAppliedMigrations(databasePath: string): AppliedMigration[] {
  if (!isPersistentDatabase(databasePath)) return [];
  const resolvedPath = path.resolve(databasePath);
  if (!fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).size === 0) return [];
  const database = new Database(resolvedPath, { readonly: true, fileMustExist: true });
  try {
    const hasTable = database
      .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'migrations' LIMIT 1`)
      .get();
    if (!hasTable) return [];
    return database
      .prepare('SELECT timestamp, name FROM migrations ORDER BY id ASC')
      .all()
      .map((row) => {
        const migration = row as { timestamp: number | string; name: string };
        return { timestamp: Number(migration.timestamp), name: migration.name };
      });
  } finally {
    database.close();
  }
}

function assertSupportedSchema(databasePath: string): AppliedMigration[] {
  const applied = readAppliedMigrations(databasePath);
  if (applied.length > MIGRATION_REGISTRY.length) {
    throw new Error('Database schema is newer than this application');
  }
  for (const [index, migration] of applied.entries()) {
    const known = migrationByName(migration.name);
    const expected = MIGRATION_REGISTRY[index];
    if (
      !known ||
      known.id !== migration.timestamp ||
      expected?.name !== migration.name ||
      expected.id !== migration.timestamp
    ) {
      throw new Error(`Database schema is newer or unsupported: ${migration.name}`);
    }
  }
  return applied;
}

function hasColumn(database: Database.Database, tableName: string, columnName: string): boolean {
  const escapedTable = tableName.replace(/"/g, '""');
  return (database.pragma(`table_info("${escapedTable}")`) as Array<{ name: string }>).some(
    (column) => column.name === columnName
  );
}

/** Recognize only the exact post-cutover schema formerly supported by ledger adoption. */
function isRecognizedCurrentUnversionedSchema(databasePath: string): boolean {
  if (!isPersistentDatabase(databasePath) || !fs.existsSync(databasePath)) return false;
  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    const tables = new Set(
      (database.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as Array<{
        name: string;
      }>).map((row) => row.name)
    );
    return (
      !tables.has('migrations') &&
      tables.has('teacher') &&
      tables.has('class_group') &&
      tables.has('class_subject_requirement') &&
      tables.has('teacher_subject_capability') &&
      tables.has('teaching_assignment') &&
      !tables.has('teacher_class_subject_assignment') &&
      !hasColumn(database, 'teacher', 'classAssignments') &&
      !hasColumn(database, 'teacher', 'primarySubjectIds') &&
      !hasColumn(database, 'class_group', 'subjectRequirements')
    );
  } finally {
    database.close();
  }
}

function adoptCurrentMigrationLedger(databasePath: string): void {
  const database = new Database(databasePath, { fileMustExist: true });
  try {
    database.transaction(() => {
      database.exec(
        `CREATE TABLE "migrations" (
          "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          "timestamp" bigint NOT NULL,
          "name" varchar NOT NULL
        )`
      );
      const insert = database.prepare(
        'INSERT INTO migrations (timestamp, name) VALUES (?, ?)'
      );
      for (const migration of MIGRATION_REGISTRY) insert.run(migration.id, migration.name);
    })();
  } finally {
    database.close();
  }
}

export function currentDatabaseSchema(databasePath: string): DatabaseSchemaIdentity {
  const applied = assertSupportedSchema(databasePath);
  if (applied.length === 0) return { id: 0, name: 'unversioned', ordinal: 0 };
  const latest = migrationByName(applied.at(-1)!.name)!;
  return { id: latest.id, name: latest.name, ordinal: latest.ordinal };
}

export async function createDatabaseBackup(
  databasePath: string,
  reason = 'backup',
  destinationDirectory?: string
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

    const directory = destinationDirectory
      ? path.resolve(destinationDirectory)
      : path.dirname(resolvedPath);
    fs.mkdirSync(directory, { recursive: true });
    const backupPath = path.join(
      directory,
      `${path.basename(resolvedPath)}.${reason}-${timestampForFileName()}.db`
    );
    await database.backup(backupPath);
    validateDatabaseFile(backupPath);
    return backupPath;
  } finally {
    database.close();
  }
}

export function pruneDatabaseBackups(
  directory: string,
  databaseFileName: string,
  now = Date.now(),
  protectedPaths: ReadonlySet<string> = new Set()
): void {
  if (!fs.existsSync(directory)) return;
  const candidates = fs.readdirSync(directory)
    .filter((name) => name.startsWith(`${databaseFileName}.`) && name.endsWith('.db'))
    .map((name) => ({
      path: path.join(directory, name),
      modified: fs.statSync(path.join(directory, name)).mtimeMs,
    }))
    .sort((left, right) => right.modified - left.modified);
  for (const [index, candidate] of candidates.entries()) {
    if (
      !protectedPaths.has(path.resolve(candidate.path)) &&
      index >= MINIMUM_RETAINED_BACKUPS &&
      now - candidate.modified > BACKUP_RETENTION_MS
    ) {
      fs.rmSync(candidate.path, { force: true });
    }
  }
}

/** Back up an existing database only when a managed migration is pending. */
export async function backupBeforePendingMigrations(
  databasePath: string,
  latestMigrationName = LATEST_DATABASE_MIGRATION,
  destinationDirectory?: string
): Promise<string | null> {
  if (!isPersistentDatabase(databasePath)) return null;
  const resolvedPath = path.resolve(databasePath);
  if (!fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).size === 0) return null;
  const applied = assertSupportedSchema(resolvedPath);
  if (applied.some((migration) => migration.name === latestMigrationName)) return null;
  return createDatabaseBackup(resolvedPath, 'migration', destinationDirectory);
}

export async function runDatabaseUpgrade(
  options: DatabaseUpgradeOptions
): Promise<DatabaseUpgradeResult> {
  const resolvedPath = isPersistentDatabase(options.databasePath)
    ? path.resolve(options.databasePath)
    : options.databasePath;
  const recoveryDirectory = path.resolve(options.recoveryDirectory);
  fs.mkdirSync(recoveryDirectory, { recursive: true });
  reconcileInterruptedDatabaseUpgrade(resolvedPath, recoveryDirectory);
  const applied = assertSupportedSchema(resolvedPath);
  const adoptCurrentLedger =
    applied.length === 0 && isRecognizedCurrentUnversionedSchema(resolvedPath);
  const migrationsPending = applied.length < MIGRATION_REGISTRY.length;
  let backupPath: string | null = null;
  let journal: UpgradeJournal | null = null;
  const filePath = journalPath(recoveryDirectory, resolvedPath);

  try {
    if (migrationsPending && isPersistentDatabase(resolvedPath) && fs.existsSync(resolvedPath)) {
      options.onStage?.('backup');
      backupPath = await createDatabaseBackup(resolvedPath, 'migration', recoveryDirectory);
      if (backupPath) {
        const now = new Date().toISOString();
        journal = {
          formatVersion: 1,
          operationId: crypto.randomUUID(),
          status: 'prepared',
          databasePath: resolvedPath,
          backupPath,
          backupSha256: sha256File(backupPath),
          target: {
            id: LATEST_MIGRATION.id,
            name: LATEST_MIGRATION.name,
            ordinal: LATEST_MIGRATION.ordinal,
          },
          createdAt: now,
          updatedAt: now,
        };
        writeJsonDurably(filePath, journal);
        journal = updateJournal(filePath, journal, { status: 'migrating' });
      }
    }

    options.onStage?.('migration');
    if (adoptCurrentLedger) adoptCurrentMigrationLedger(resolvedPath);
    await options.dataSource.initialize();
    if (journal) journal = updateJournal(filePath, journal, { status: 'verifying' });
    options.onStage?.('integrity');
    await options.verify(options.dataSource);
    if (journal) {
      updateJournal(filePath, journal, { status: 'committed' });
      pruneDatabaseBackups(recoveryDirectory, path.basename(resolvedPath));
    }
    return {
      backupPath,
      schema: {
        id: LATEST_MIGRATION.id,
        name: LATEST_MIGRATION.name,
        ordinal: LATEST_MIGRATION.ordinal,
      },
    };
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    if (options.dataSource.isInitialized) {
      await options.dataSource.destroy().catch(() => undefined);
    }
    if (journal) {
      restoreUpgradeBackup(journal, recoveryDirectory);
      updateJournal(filePath, journal, { status: 'rolled_back', failure: failure.message });
      pruneDatabaseBackups(
        recoveryDirectory,
        path.basename(resolvedPath),
        Date.now(),
        new Set([path.resolve(journal.backupPath)])
      );
    }
    throw failure;
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
