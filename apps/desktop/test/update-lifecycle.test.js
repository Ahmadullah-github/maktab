const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { UpdateManager } = require('../update');

class FakeUpdater extends EventEmitter {
  quitAndInstall() { this.installRequested = true; }
  async downloadUpdate() { return [this.downloadPath]; }
}

function fixture(root, { createPreUpdateBackup, getLicenseStatus } = {}) {
  const updater = new FakeUpdater();
  const artifact = Buffer.from('verified installer bytes');
  const filename = 'Maktab-Timetable-1.0.1-x64.exe';
  updater.downloadPath = path.join(root, filename);
  fs.writeFileSync(updater.downloadPath, artifact);
  const manifest = {
    build_id: '1.0.1-pilot-target000001', version: '1.0.1',
    artifacts: [{
      filename, size: artifact.length,
      sha256: crypto.createHash('sha256').update(artifact).digest('hex'),
      sha512: crypto.createHash('sha512').update(artifact).digest('base64'),
    }],
  };
  const manager = new UpdateManager({
    app: { isPackaged: false, getPath: () => root },
    runtimeInfo: { appVersion: '1.0.0', buildId: '1.0.0-pilot-source000001', channel: 'pilot' },
    releaseConfig: {
      releaseApiUrl: '', updateFeed: { allowedOrigins: [] },
      trust: { updateKeyIds: [], authenticodePublishers: [] },
    },
    deviceId: 'device-identifier-0000000000000001',
    userDataPath: root,
    updater,
    createPreUpdateBackup,
    getLicenseStatus,
  });
  manager.status = { state: 'available', channel: 'pilot', available: { version: '1.0.1' } };
  manager.verifiedManifest = manifest;
  return { manager, manifest, updater };
}

test('verified update creates recovery journal and commits after target starts', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-update-lifecycle-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const recoveryPath = path.join(root, 'recovery.db');
  fs.writeFileSync(recoveryPath, 'database backup');
  const { manager, manifest, updater } = fixture(root, { createPreUpdateBackup: async () => recoveryPath });
  await manager.download();
  assert.equal(manager.status.state, 'downloaded');
  assert.deepEqual(await manager.install(), { installing: true });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(updater.installRequested, true);
  const journalPath = path.join(root, 'updates', 'update-journal.json');
  assert.equal(JSON.parse(fs.readFileSync(journalPath)).state, 'installing');

  const target = fixture(root, { createPreUpdateBackup: async () => recoveryPath }).manager;
  target.runtime.buildId = manifest.build_id;
  target.runtime.appVersion = manifest.version;
  await target.reconcile();
  assert.equal(JSON.parse(fs.readFileSync(journalPath)).state, 'installing');
  await target.completeReconciliation({
    readiness: {
      status: 'ready', buildId: manifest.build_id,
      database: { status: 'ok', integrity: 'ok', schemaVersion: 22 },
      solver: { status: 'ok', version: '1.0.1' },
      licenseVerifier: { status: 'ok' },
    },
    licenseStatus: { state: 'unactivated', activationId: null },
  });
  assert.equal(JSON.parse(fs.readFileSync(journalPath)).state, 'committed');
});

test('first-launch verification preserves an activated identity', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-update-activation-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const recoveryPath = path.join(root, 'recovery.db'); fs.writeFileSync(recoveryPath, 'db');
  const sourceStatus = { state: 'active', activationId: 'activation-123' };
  const source = fixture(root, {
    createPreUpdateBackup: async () => recoveryPath,
    getLicenseStatus: () => sourceStatus,
  });
  await source.manager.download(); await source.manager.install();

  const target = fixture(root, { getLicenseStatus: () => sourceStatus }).manager;
  target.runtime.buildId = source.manifest.build_id; target.runtime.appVersion = source.manifest.version;
  await target.reconcile();
  await target.completeReconciliation({
    readiness: {
      status: 'ready', buildId: source.manifest.build_id,
      database: { status: 'ok', integrity: 'ok', schema: { migrationName: 'current' } },
      solver: { status: 'ok', version: '1.0.1' }, licenseVerifier: { status: 'ok' },
    },
    licenseStatus: sourceStatus,
  });
  const journal = JSON.parse(fs.readFileSync(path.join(root, 'updates', 'update-journal.json')));
  assert.equal(journal.state, 'committed');
  assert.equal(journal.verification.activationPreserved, true);
});

test('failed first-launch verification remains fail-closed with recovery preserved', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-update-verification-failure-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const recoveryPath = path.join(root, 'recovery.db'); fs.writeFileSync(recoveryPath, 'db');
  const source = fixture(root, { createPreUpdateBackup: async () => recoveryPath });
  await source.manager.download(); await source.manager.install();
  const target = fixture(root).manager;
  target.runtime.buildId = source.manifest.build_id; target.runtime.appVersion = source.manifest.version;
  await target.reconcile();
  await assert.rejects(target.completeReconciliation({
    readiness: {
      status: 'ready', buildId: source.manifest.build_id,
      database: { status: 'ok', integrity: 'failed' },
      solver: { status: 'ok', version: '1.0.1' }, licenseVerifier: { status: 'ok' },
    },
    licenseStatus: { state: 'unactivated', activationId: null },
  }), /readiness/);
  const journalPath = path.join(root, 'updates', 'update-journal.json');
  assert.equal(JSON.parse(fs.readFileSync(journalPath)).state, 'verification_failed');
  assert.equal(fs.existsSync(recoveryPath), true);
  await assert.rejects(fixture(root).manager.reconcile(), /did not pass first-launch verification/);
});

test('backup failure prevents installation and journal creation', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-update-backup-failure-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const { manager, updater } = fixture(root, {
    createPreUpdateBackup: async () => { throw new Error('disk full'); },
  });
  await manager.download();
  await assert.rejects(manager.install(), /disk full/);
  assert.equal(updater.installRequested, undefined);
  assert.equal(fs.existsSync(path.join(root, 'updates', 'update-journal.json')), false);
});

test('tampered download is deleted and a clean retry remains possible', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-update-tamper-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const recoveryPath = path.join(root, 'recovery.db'); fs.writeFileSync(recoveryPath, 'db');
  const { manager, updater } = fixture(root, { createPreUpdateBackup: async () => recoveryPath });
  fs.appendFileSync(updater.downloadPath, 'tamper');
  await assert.rejects(manager.download(), /integrity/);
  assert.equal(fs.existsSync(updater.downloadPath), false);
  const clean = fixture(root, { createPreUpdateBackup: async () => recoveryPath });
  await clean.manager.download();
  assert.equal(clean.manager.status.state, 'downloaded');
});
