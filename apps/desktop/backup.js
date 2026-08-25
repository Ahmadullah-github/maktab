const AdmZip = require('adm-zip');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const MAGIC = Buffer.from('MAKTAB-BACKUP\n');
const MAX_BACKUP_BYTES = 1024 * 1024 * 1024;
const MINIMUM_FREE_SPACE_RESERVE = 64 * 1024 * 1024;
const RETENTION_AGE_MS = 30 * 86_400_000;
const RETENTION_MINIMUM = 3;
const KDF_PARAMETERS = Object.freeze({ name: 'scrypt', N: 32768, r: 8, p: 1 });

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value, required, optional = []) {
  if (!isPlainObject(value)) throw new Error('Backup metadata must be an object');
  const allowed = new Set([...required, ...optional]);
  if (required.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) {
    throw new Error('Backup metadata is incomplete');
  }
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new Error('Backup metadata contains unsupported properties');
  }
  return value;
}

function deriveKey(passphrase, salt, parameters) {
  if (typeof passphrase !== 'string' || Buffer.byteLength(passphrase, 'utf8') < 12) {
    throw new Error('Backup passphrase must contain at least 12 UTF-8 bytes');
  }
  if (
    !isPlainObject(parameters) ||
    parameters.name !== KDF_PARAMETERS.name ||
    parameters.N !== KDF_PARAMETERS.N ||
    parameters.r !== KDF_PARAMETERS.r ||
    parameters.p !== KDF_PARAMETERS.p
  ) {
    throw new Error('Backup key-derivation parameters are not supported');
  }
  return crypto.scryptSync(passphrase, salt, 32, {
    N: parameters.N,
    r: parameters.r,
    p: parameters.p,
    maxmem: 128 * 1024 * 1024,
  });
}

function encodeEnvelope(zipBuffer, passphrase) {
  if (!Buffer.isBuffer(zipBuffer) || zipBuffer.length > MAX_BACKUP_BYTES) {
    throw new Error('Backup payload is too large');
  }
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    deriveKey(passphrase, salt, KDF_PARAMETERS),
    iv
  );
  const ciphertext = Buffer.concat([cipher.update(zipBuffer), cipher.final()]);
  const header = Buffer.from(`${JSON.stringify({
    format_version: 1,
    cipher: 'aes-256-gcm',
    kdf: KDF_PARAMETERS,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  })}\n`);
  return Buffer.concat([MAGIC, header, ciphertext]);
}

function decodeEnvelope(buffer, passphrase) {
  if (!Buffer.isBuffer(buffer) || buffer.length > MAX_BACKUP_BYTES || buffer.length <= MAGIC.length) {
    throw new Error('Backup file size is invalid');
  }
  if (!buffer.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Not a Maktab backup file');
  const headerEnd = buffer.indexOf(10, MAGIC.length);
  if (headerEnd < 0 || headerEnd - MAGIC.length > 4096) throw new Error('Backup header is incomplete');
  const header = assertExactKeys(
    JSON.parse(buffer.subarray(MAGIC.length, headerEnd).toString('utf8')),
    ['format_version', 'cipher', 'kdf', 'salt', 'iv', 'tag']
  );
  if (header.format_version !== 1 || header.cipher !== 'aes-256-gcm') {
    throw new Error('Backup envelope format is not supported');
  }
  const salt = Buffer.from(header.salt, 'base64');
  const iv = Buffer.from(header.iv, 'base64');
  const tag = Buffer.from(header.tag, 'base64');
  if (salt.length !== 16 || iv.length !== 12 || tag.length !== 16) {
    throw new Error('Backup cryptographic metadata is invalid');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    deriveKey(passphrase, salt, header.kdf),
    iv
  );
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(buffer.subarray(headerEnd + 1)), decipher.final()]);
}

function normalizeCurrentSchema(value) {
  if (Number.isInteger(value) && value >= 0) {
    return { migrationId: 0, migrationName: 'legacy-count', ordinal: value };
  }
  const schema = assertExactKeys(value, ['migrationId', 'migrationName', 'ordinal']);
  if (!Number.isInteger(schema.migrationId) || schema.migrationId < 0) {
    throw new Error('Current database migration ID is invalid');
  }
  if (typeof schema.migrationName !== 'string' || schema.migrationName.length > 128) {
    throw new Error('Current database migration name is invalid');
  }
  if (!Number.isInteger(schema.ordinal) || schema.ordinal < 0) {
    throw new Error('Current database migration ordinal is invalid');
  }
  return schema;
}

function validateManifest(value, currentSchema) {
  const manifest = value;
  if (!isPlainObject(manifest)) throw new Error('Backup manifest is invalid');
  if (manifest.format_version === 1) {
    assertExactKeys(manifest, [
      'format_version', 'created_at', 'app_version', 'build_id', 'db_schema_version',
      'database_sha256', 'database_size', 'source_platform', 'scope',
    ]);
    if (!Number.isInteger(manifest.db_schema_version) || manifest.db_schema_version < 0) {
      throw new Error('Backup schema ordinal is invalid');
    }
    if (manifest.db_schema_version > currentSchema.ordinal) {
      throw new Error('Backup was created by a newer Maktab version');
    }
  } else if (manifest.format_version === 2) {
    assertExactKeys(manifest, [
      'format_version', 'created_at', 'app_version', 'build_id', 'db_schema',
      'database_sha256', 'database_size', 'source_platform', 'scope',
    ]);
    const schema = assertExactKeys(manifest.db_schema, ['migration_id', 'migration_name', 'ordinal']);
    if (!Number.isInteger(schema.migration_id) || schema.migration_id < 0) {
      throw new Error('Backup migration ID is invalid');
    }
    if (typeof schema.migration_name !== 'string' || schema.migration_name.length > 128) {
      throw new Error('Backup migration name is invalid');
    }
    if (!Number.isInteger(schema.ordinal) || schema.ordinal < 0) {
      throw new Error('Backup migration ordinal is invalid');
    }
    if (schema.ordinal > currentSchema.ordinal || schema.migration_id > currentSchema.migrationId) {
      throw new Error('Backup was created by a newer Maktab version');
    }
  } else {
    throw new Error('Backup manifest format is not supported');
  }
  if (manifest.scope !== 'desktop-timetable') throw new Error('Backup scope is incompatible');
  for (const key of ['created_at', 'app_version', 'build_id', 'source_platform']) {
    if (typeof manifest[key] !== 'string' || manifest[key].length < 1 || manifest[key].length > 256) {
      throw new Error(`Backup manifest field is invalid: ${key}`);
    }
  }
  if (!Number.isInteger(manifest.database_size) || manifest.database_size < 1 || manifest.database_size > MAX_BACKUP_BYTES) {
    throw new Error('Backup database size is invalid');
  }
  if (typeof manifest.database_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.database_sha256)) {
    throw new Error('Backup database hash is invalid');
  }
  return manifest;
}

function readArchive(buffer, currentSchema) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const names = entries.map((entry) => entry.entryName);
  if (
    entries.length !== 2 ||
    new Set(names).size !== 2 ||
    !names.includes('manifest.json') ||
    !names.includes('timetable.db') ||
    names.some((name) => name.includes('/') || name.includes('\\') || name.includes('..'))
  ) {
    throw new Error('Backup archive contents are invalid');
  }
  for (const entry of entries) {
    if (entry.header.size > MAX_BACKUP_BYTES) throw new Error('Backup archive entry is too large');
  }
  const manifest = validateManifest(JSON.parse(zip.readAsText('manifest.json')), currentSchema);
  const database = zip.readFile('timetable.db');
  if (
    !database ||
    database.length !== manifest.database_size ||
    crypto.createHash('sha256').update(database).digest('hex') !== manifest.database_sha256
  ) {
    throw new Error('Backup database hash does not match its manifest');
  }
  return { manifest, database };
}

async function ensureFreeSpace(directory, requiredBytes) {
  const stats = await fs.promises.statfs(directory);
  const available = Number(stats.bavail) * Number(stats.bsize);
  const reserve = Math.max(MINIMUM_FREE_SPACE_RESERVE, Math.ceil(requiredBytes * 0.1));
  if (!Number.isFinite(available) || available < requiredBytes + reserve) {
    const error = new Error('Insufficient disk space for this backup or restore operation');
    error.code = 'ENOSPC';
    throw error;
  }
}

async function writeFileDurably(filePath, data) {
  const handle = await fs.promises.open(filePath, 'wx', 0o600);
  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function writeJsonDurably(filePath, value) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${crypto.randomUUID()}.tmp`;
  await writeFileDurably(temporary, Buffer.from(`${JSON.stringify(value, null, 2)}\n`));
  await fs.promises.rename(temporary, filePath);
}

function validateDatabase(filePath) {
  const validation = new Database(filePath, { readonly: true, fileMustExist: true });
  try {
    if (validation.pragma('integrity_check', { simple: true }) !== 'ok') {
      throw new Error('Backup database integrity check failed');
    }
    if (validation.pragma('foreign_key_check').length > 0) {
      throw new Error('Backup database has invalid relationships');
    }
  } finally {
    validation.close();
  }
}

function pruneAutomaticBackups(directory, databaseFileName, protectedPaths = new Set(), now = Date.now()) {
  if (!fs.existsSync(directory)) return;
  const files = fs.readdirSync(directory)
    .filter((name) => name.startsWith(`${databaseFileName}.`) && name.endsWith('.db'))
    .map((name) => ({ path: path.join(directory, name), modified: fs.statSync(path.join(directory, name)).mtimeMs }))
    .sort((left, right) => right.modified - left.modified);
  files.forEach((file, index) => {
    if (
      index >= RETENTION_MINIMUM &&
      now - file.modified > RETENTION_AGE_MS &&
      !protectedPaths.has(path.resolve(file.path))
    ) {
      fs.rmSync(file.path, { force: true });
    }
  });
}

class BackupManager {
  constructor({ app, dialog, runtimeInfo, createRecoveryPoint, stopApi, startApi, getCurrentSchema }) {
    this.app = app;
    this.dialog = dialog;
    this.runtime = runtimeInfo;
    this.createRecoveryPoint = createRecoveryPoint;
    this.stopApi = stopApi;
    this.startApi = startApi;
    this.getCurrentSchema = getCurrentSchema;
    this.pendingRestores = new Map();
    this.recoveryDirectory = path.join(this.app.getPath('userData'), 'recovery');
    this.restoreJournalPath = path.join(this.recoveryDirectory, 'restore-journal.json');
  }

  currentSchema() {
    return normalizeCurrentSchema(this.getCurrentSchema());
  }

  async create(passphrase) {
    const selected = await this.dialog.showSaveDialog({
      title: 'Create encrypted Maktab backup',
      defaultPath: `maktab-${new Date().toISOString().slice(0, 10)}.maktab-backup`,
      filters: [{ name: 'Maktab backup', extensions: ['maktab-backup'] }],
    });
    if (selected.canceled || !selected.filePath) return { canceled: true };
    const recoveryPath = await this.createRecoveryPoint();
    const database = await fs.promises.readFile(recoveryPath);
    if (database.length > MAX_BACKUP_BYTES) throw new Error('Database is too large to back up');
    const schema = this.currentSchema();
    const manifest = {
      format_version: 2,
      created_at: new Date().toISOString(),
      app_version: this.runtime.appVersion,
      build_id: this.runtime.buildId,
      db_schema: {
        migration_id: schema.migrationId,
        migration_name: schema.migrationName,
        ordinal: schema.ordinal,
      },
      database_sha256: crypto.createHash('sha256').update(database).digest('hex'),
      database_size: database.length,
      source_platform: process.platform,
      scope: 'desktop-timetable',
    };
    const zip = new AdmZip();
    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest)));
    zip.addFile('timetable.db', database);
    const encoded = encodeEnvelope(zip.toBuffer(), passphrase);
    await fs.promises.mkdir(path.dirname(selected.filePath), { recursive: true });
    await ensureFreeSpace(path.dirname(selected.filePath), encoded.length);
    const temporary = `${selected.filePath}.${crypto.randomUUID()}.tmp`;
    try {
      await writeFileDurably(temporary, encoded);
      await fs.promises.rename(temporary, selected.filePath);
    } catch (error) {
      await fs.promises.rm(temporary, { force: true });
      throw error;
    }
    return { canceled: false, fileName: path.basename(selected.filePath), manifest };
  }

  async readAndValidate(filePath, passphrase) {
    const decoded = decodeEnvelope(await fs.promises.readFile(filePath), passphrase);
    const archive = readArchive(decoded, this.currentSchema());
    await fs.promises.mkdir(this.recoveryDirectory, { recursive: true });
    const validationPath = path.join(this.recoveryDirectory, `inspect-${crypto.randomUUID()}.db`);
    try {
      await writeFileDurably(validationPath, archive.database);
      validateDatabase(validationPath);
    } finally {
      await fs.promises.rm(validationPath, { force: true });
    }
    return archive;
  }

  async inspect(filePath, passphrase) {
    return (await this.readAndValidate(filePath, passphrase)).manifest;
  }

  async selectAndInspect(passphrase) {
    const selected = await this.dialog.showOpenDialog({
      title: 'Inspect Maktab backup',
      properties: ['openFile'],
      filters: [{ name: 'Maktab backup', extensions: ['maktab-backup'] }],
    });
    if (selected.canceled || selected.filePaths.length !== 1) return { canceled: true };
    const filePath = selected.filePaths[0];
    if (path.extname(filePath) !== '.maktab-backup') throw new Error('Select a .maktab-backup file');
    const manifest = await this.inspect(filePath, passphrase);
    const handle = crypto.randomUUID();
    this.pendingRestores.set(handle, { filePath, expires: Date.now() + 10 * 60_000 });
    return { canceled: false, handle, manifest };
  }

  async rollbackRestore(journal) {
    await this.stopApi().catch(() => undefined);
    for (const suffix of ['-wal', '-shm']) {
      await fs.promises.rm(`${journal.databasePath}${suffix}`, { force: true });
    }
    if (journal.status === 'original_moved' || journal.status === 'installed') {
      await fs.promises.rm(journal.databasePath, { force: true });
      if (journal.originalPath && fs.existsSync(journal.originalPath)) {
        await fs.promises.rename(journal.originalPath, journal.databasePath);
      }
    }
    await fs.promises.rm(journal.stagePath, { force: true });
    const rolledBack = { ...journal, status: 'rolled_back', updatedAt: new Date().toISOString() };
    await writeJsonDurably(this.restoreJournalPath, rolledBack);
    if (fs.existsSync(journal.databasePath)) validateDatabase(journal.databasePath);
    return rolledBack;
  }

  async reconcileInterruptedRestore() {
    if (!fs.existsSync(this.restoreJournalPath)) return;
    const journal = JSON.parse(await fs.promises.readFile(this.restoreJournalPath, 'utf8'));
    if (!isPlainObject(journal) || journal.formatVersion !== 1 || typeof journal.status !== 'string') {
      throw new Error('Restore recovery journal is invalid');
    }
    if (journal.status === 'committed' || journal.status === 'rolled_back') return;
    await this.rollbackRestore(journal);
  }

  async restore(filePath, passphrase) {
    if (typeof filePath !== 'string' || path.extname(filePath) !== '.maktab-backup') {
      throw new Error('Select a .maktab-backup file');
    }
    const { manifest, database } = await this.readAndValidate(filePath, passphrase);
    const databasePath = path.join(this.app.getPath('userData'), 'timetable.db');
    await fs.promises.mkdir(path.dirname(databasePath), { recursive: true });
    await fs.promises.mkdir(this.recoveryDirectory, { recursive: true });
    await ensureFreeSpace(path.dirname(databasePath), database.length);
    const operationId = crypto.randomUUID();
    const stagePath = `${databasePath}.${operationId}.restore`;
    const originalPath = path.join(
      this.recoveryDirectory,
      `${path.basename(databasePath)}.pre-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.db`
    );
    await writeFileDurably(stagePath, database);
    validateDatabase(stagePath);

    let journal = {
      formatVersion: 1,
      operationId,
      status: 'prepared',
      databasePath,
      stagePath,
      originalPath: fs.existsSync(databasePath) ? originalPath : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await writeJsonDurably(this.restoreJournalPath, journal);
    await this.stopApi();
    try {
      for (const suffix of ['-wal', '-shm']) {
        await fs.promises.rm(`${databasePath}${suffix}`, { force: true });
      }
      if (journal.originalPath) await fs.promises.rename(databasePath, journal.originalPath);
      journal = { ...journal, status: 'original_moved', updatedAt: new Date().toISOString() };
      await writeJsonDurably(this.restoreJournalPath, journal);
      await fs.promises.rename(stagePath, databasePath);
      journal = { ...journal, status: 'installed', updatedAt: new Date().toISOString() };
      await writeJsonDurably(this.restoreJournalPath, journal);
      await this.startApi();
      journal = { ...journal, status: 'committed', updatedAt: new Date().toISOString() };
      await writeJsonDurably(this.restoreJournalPath, journal);
      pruneAutomaticBackups(this.recoveryDirectory, path.basename(databasePath));
      return { restored: true, manifest };
    } catch (error) {
      await this.rollbackRestore(journal);
      await this.startApi().catch(() => undefined);
      throw error;
    }
  }

  async restoreHandle(handle, passphrase) {
    const pending = this.pendingRestores.get(handle);
    this.pendingRestores.delete(handle);
    if (!pending || pending.expires < Date.now()) {
      throw new Error('Restore confirmation expired; inspect the backup again');
    }
    return this.restore(pending.filePath, passphrase);
  }
}

module.exports = {
  BackupManager,
  decodeEnvelope,
  encodeEnvelope,
  ensureFreeSpace,
  pruneAutomaticBackups,
  readArchive,
};
