'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const AdmZip = require('adm-zip');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');
const {
  BackupManager,
  decodeEnvelope,
  encodeEnvelope,
  ensureFreeSpace,
  pruneAutomaticBackups,
  readArchive,
} = require('../backup');

const PASSPHRASE = 'correct horse battery staple';
const CURRENT_SCHEMA = {
  migrationId: 1785300000000,
  migrationName: 'CompleteCanonicalAssignmentCutover1785300000000',
  ordinal: 22,
};

function databaseBytes(label) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-backup-db-'));
  const filePath = path.join(directory, 'database.db');
  const database = new Database(filePath);
  database.exec('CREATE TABLE evidence (value TEXT NOT NULL)');
  database.prepare('INSERT INTO evidence (value) VALUES (?)').run(label);
  database.close();
  const bytes = fs.readFileSync(filePath);
  fs.rmSync(directory, { recursive: true, force: true });
  return bytes;
}

function archive(database, schema = CURRENT_SCHEMA, extraEntry = false) {
  const manifest = {
    format_version: 2,
    created_at: new Date().toISOString(),
    app_version: '1.0.0',
    build_id: 'test',
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
  if (extraEntry) zip.addFile('../unexpected', Buffer.from('no'));
  return { encoded: encodeEnvelope(zip.toBuffer(), PASSPHRASE), manifest };
}

function manager(directory, overrides = {}) {
  return new BackupManager({
    app: { getPath: () => directory },
    dialog: {},
    runtimeInfo: { appVersion: '1.0.0', buildId: 'test' },
    createRecoveryPoint: async () => path.join(directory, 'timetable.db'),
    stopApi: overrides.stopApi ?? (async () => undefined),
    startApi: overrides.startApi ?? (async () => undefined),
    getCurrentSchema: () => CURRENT_SCHEMA,
  });
}

test('encrypted backup rejects wrong passphrases, corruption, newer schemas, and ZIP abuse', () => {
  const database = databaseBytes('backup');
  const valid = archive(database).encoded;
  assert.throws(() => decodeEnvelope(valid, 'wrong passphrase value'), /authenticate|bad decrypt/i);
  const corrupted = Buffer.from(valid);
  corrupted[corrupted.length - 1] ^= 0xff;
  assert.throws(() => decodeEnvelope(corrupted, PASSPHRASE), /authenticate|bad decrypt/i);
  assert.throws(
    () => readArchive(
      decodeEnvelope(archive(database, {
        migrationId: CURRENT_SCHEMA.migrationId + 1,
        migrationName: 'FutureMigration1785400000000',
        ordinal: 23,
      }).encoded, PASSPHRASE),
      CURRENT_SCHEMA
    ),
    /newer/
  );
  assert.throws(
    () => readArchive(decodeEnvelope(archive(database, CURRENT_SCHEMA, true).encoded, PASSPHRASE), CURRENT_SCHEMA),
    /contents/
  );
});

test('failed restored API readiness atomically rolls back the original database', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-restore-rollback-'));
  try {
    const livePath = path.join(directory, 'timetable.db');
    fs.writeFileSync(livePath, databaseBytes('original'));
    const backupPath = path.join(directory, 'candidate.maktab-backup');
    fs.writeFileSync(backupPath, archive(databaseBytes('replacement')).encoded);
    const backupManager = manager(directory, {
      startApi: async () => { throw new Error('injected readiness failure'); },
    });
    await assert.rejects(backupManager.restore(backupPath, PASSPHRASE), /readiness failure/);
    const live = new Database(livePath, { readonly: true });
    assert.equal(live.prepare('SELECT value FROM evidence').get().value, 'original');
    live.close();
    const journal = JSON.parse(
      fs.readFileSync(path.join(directory, 'recovery', 'restore-journal.json'), 'utf8')
    );
    assert.equal(journal.status, 'rolled_back');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('an interrupted installed restore rolls back on the next launch', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-restore-reconcile-'));
  try {
    const recovery = path.join(directory, 'recovery');
    fs.mkdirSync(recovery, { recursive: true });
    const databasePath = path.join(directory, 'timetable.db');
    const originalPath = path.join(recovery, 'timetable.db.pre-restore.db');
    const stagePath = `${databasePath}.restore`;
    fs.writeFileSync(databasePath, databaseBytes('replacement'));
    fs.writeFileSync(originalPath, databaseBytes('original'));
    fs.writeFileSync(
      path.join(recovery, 'restore-journal.json'),
      JSON.stringify({
        formatVersion: 1,
        operationId: crypto.randomUUID(),
        status: 'installed',
        databasePath,
        stagePath,
        originalPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    );
    await manager(directory).reconcileInterruptedRestore();
    const live = new Database(databasePath, { readonly: true });
    assert.equal(live.prepare('SELECT value FROM evidence').get().value, 'original');
    live.close();
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('automatic retention keeps newest three, young files, protected recovery, and user exports', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-retention-'));
  try {
    const now = Date.now();
    const protectedFile = path.join(directory, 'timetable.db.protected.db');
    const userExport = path.join(directory, 'my-school.maktab-backup');
    fs.writeFileSync(userExport, 'user');
    const files = Array.from({ length: 7 }, (_, index) => {
      const filePath = index === 6
        ? protectedFile
        : path.join(directory, `timetable.db.copy-${index}.db`);
      fs.writeFileSync(filePath, String(index));
      const age = index < 2 ? index * 1000 : 40 * 86_400_000 + index * 1000;
      fs.utimesSync(filePath, new Date(now - age), new Date(now - age));
      return filePath;
    });
    pruneAutomaticBackups(
      directory,
      'timetable.db',
      new Set([path.resolve(protectedFile)]),
      now
    );
    assert.equal(fs.existsSync(userExport), true);
    assert.equal(fs.existsSync(protectedFile), true);
    assert.equal(files.filter((filePath) => fs.existsSync(filePath)).length, 4);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('disk preflight preserves the ENOSPC contract and required reserve', async () => {
  const originalStatfs = fs.promises.statfs;
  fs.promises.statfs = async () => ({ bavail: 1, bsize: 4096 });
  try {
    await assert.rejects(
      ensureFreeSpace(os.tmpdir(), 1024),
      (error) => error.code === 'ENOSPC' && /Insufficient disk space/.test(error.message)
    );
  } finally {
    fs.promises.statfs = originalStatfs;
  }
});
