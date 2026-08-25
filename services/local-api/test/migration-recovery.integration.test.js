'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const zlib = require('node:zlib');
const Database = require('better-sqlite3');
require('reflect-metadata');
const { DataSource } = require('typeorm');
const { AppDataSource } = require('../dist/ormconfig');
const {
  assertDatabaseIntegrity,
  createDatabaseBackup,
  currentDatabaseSchema,
  runDatabaseUpgrade,
} = require('../dist/src/database/bootstrap');
const {
  logicalFingerprint,
  sha256Buffer,
  sha256File,
} = require('./helpers/migration-fixtures');

const fixturesDirectory = path.join(__dirname, 'fixtures', 'migrations');

function manifests() {
  return fs.readdirSync(fixturesDirectory)
    .filter((name) => name.endsWith('.manifest.json'))
    .sort()
    .map((name) => ({
      name,
      manifest: JSON.parse(fs.readFileSync(path.join(fixturesDirectory, name), 'utf8')),
      archive: path.join(fixturesDirectory, name.replace('.manifest.json', '.db.gz')),
    }));
}

function unpackFixture(fixture, directory, fileName = 'timetable.db') {
  const compressed = fs.readFileSync(fixture.archive);
  assert.equal(sha256Buffer(compressed), fixture.manifest.compressedSha256);
  const databaseBytes = zlib.gunzipSync(compressed);
  assert.equal(sha256Buffer(databaseBytes), fixture.manifest.databaseSha256);
  const databasePath = path.join(directory, fileName);
  fs.writeFileSync(databasePath, databaseBytes);
  assert.equal(logicalFingerprint(databasePath), fixture.manifest.semanticFingerprint);
  return databasePath;
}

function upgradeSource(databasePath) {
  return new DataSource({ ...AppDataSource.options, database: databasePath });
}

test('all 21 supported migration checkpoints upgrade without semantic data loss', async () => {
  const fixtures = manifests();
  assert.equal(fixtures.length, 21);
  for (const fixture of fixtures) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-matrix-'));
    try {
      const databasePath = unpackFixture(fixture, directory);
      const expectedFingerprint = fixture.manifest.semanticFingerprint;
      const source = upgradeSource(databasePath);
      await runDatabaseUpgrade({
        dataSource: source,
        databasePath,
        recoveryDirectory: path.join(directory, 'recovery'),
        verify: assertDatabaseIntegrity,
      });
      assert.equal(logicalFingerprint(databasePath), expectedFingerprint, fixture.name);
      assert.equal(currentDatabaseSchema(databasePath).name, 'CompleteCanonicalAssignmentCutover1785300000000');
      const database = new Database(databasePath, { readonly: true });
      assert.equal(
        database.prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='teacher_class_subject_assignment'"
        ).get().count,
        0
      );
      assert.ok(
        database.prepare('SELECT COUNT(*) AS count FROM school_curriculum_item').get().count > 0
      );
      database.close();
      await source.destroy();
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

test('online backups include committed data still resident in WAL', async () => {
  const fixture = manifests()[0];
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-wal-backup-'));
  try {
    const databasePath = unpackFixture(fixture, directory);
    const writer = new Database(databasePath);
    writer.pragma('journal_mode = WAL');
    writer.pragma('wal_autocheckpoint = 0');
    writer.prepare(
      "INSERT INTO configuration (key, value) VALUES ('wal-evidence', 'committed-uncheckpointed')"
    ).run();
    assert.equal(fs.existsSync(`${databasePath}-wal`), true);
    const backupPath = await createDatabaseBackup(databasePath, 'wal-test', directory);
    assert.ok(backupPath);
    const backup = new Database(backupPath, { readonly: true });
    assert.equal(
      backup.prepare("SELECT value FROM configuration WHERE key='wal-evidence'").get().value,
      'committed-uncheckpointed'
    );
    backup.close();
    writer.close();
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('migration and post-migration verification failures restore the exact old database', async () => {
  const fixture = manifests().at(-1);
  for (const failureMode of ['migration', 'verification']) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `maktab-rollback-${failureMode}-`));
    try {
      const databasePath = unpackFixture(fixture, directory);
      if (failureMode === 'migration') {
        const database = new Database(databasePath);
        database.prepare(
          'UPDATE teacher_class_subject_assignment SET periodsPerWeek = periodsPerWeek + 1'
        ).run();
        database.close();
      }
      const beforeFingerprint = logicalFingerprint(databasePath);
      const source = upgradeSource(databasePath);
      await assert.rejects(
        runDatabaseUpgrade({
          dataSource: source,
          databasePath,
          recoveryDirectory: path.join(directory, 'recovery'),
          verify: async (initialized) => {
            await assertDatabaseIntegrity(initialized);
            if (failureMode === 'verification') throw new Error('injected verification failure');
          },
        }),
        failureMode === 'migration' ? /cutover refused/ : /injected verification failure/
      );
      assert.equal(logicalFingerprint(databasePath), beforeFingerprint);
      assert.equal(currentDatabaseSchema(databasePath).ordinal, 21);
      const journal = JSON.parse(
        fs.readFileSync(path.join(directory, 'recovery', 'timetable.db.upgrade-journal.json'))
      );
      assert.equal(journal.status, 'rolled_back');
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

test('unknown newer schemas are rejected without modification', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-newer-schema-'));
  try {
    const databasePath = unpackFixture(manifests().at(-1), directory);
    const database = new Database(databasePath);
    database.prepare('INSERT INTO migrations (timestamp, name) VALUES (?, ?)').run(
      1999999999999,
      'FutureSchema1999999999999'
    );
    database.close();
    const beforeHash = sha256File(databasePath);
    await assert.rejects(
      runDatabaseUpgrade({
        dataSource: upgradeSource(databasePath),
        databasePath,
        recoveryDirectory: path.join(directory, 'recovery'),
        verify: assertDatabaseIntegrity,
      }),
      /newer/
    );
    assert.equal(sha256File(databasePath), beforeHash);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
