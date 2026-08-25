const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

require('reflect-metadata');

const { DataSource } = require('typeorm');
const { AppDataSource } = require('../dist/ormconfig');

test('legacy license rows are preserved under non-authoritative table names', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-license-retirement-'));
  const databasePath = path.join(directory, 'timetable.db');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const finalMigration = 'RetireLegacyLicenseAuthority1785200000000';
  const before = new DataSource({
    ...AppDataSource.options,
    database: databasePath,
    migrations: AppDataSource.options.migrations.filter(
      (Migration) => new Migration().name !== finalMigration
    ),
    migrationsRun: true,
  });
  await before.initialize();
  await before.query(
    `INSERT INTO license
      (licenseKey, schoolName, licenseType, activatedAt, expiresAt, isActive)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)`,
    ['legacy-secret', 'Legacy School', 'annual']
  );
  await before.destroy();

  const after = new DataSource({ ...AppDataSource.options, database: databasePath, migrationsRun: true });
  await after.initialize();
  t.after(async () => { if (after.isInitialized) await after.destroy(); });
  const tables = (await after.query(
    "SELECT name FROM sqlite_master WHERE type = 'table'"
  )).map((row) => row.name);
  assert.equal(tables.includes('license'), false);
  assert.equal(tables.includes('device_trial'), false);
  assert.equal(tables.includes('contact_request'), false);
  assert.equal(tables.includes('legacy_license'), true);
  assert.equal(tables.includes('legacy_device_trial'), true);
  assert.equal(tables.includes('legacy_contact_request'), true);
  assert.deepEqual(
    await after.query('SELECT licenseKey, schoolName FROM legacy_license'),
    [{ licenseKey: 'legacy-secret', schoolName: 'Legacy School' }]
  );
});
