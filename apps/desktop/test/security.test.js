const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  isAllowedExternalUrl,
  isAllowedRendererNavigation,
  normalizeServiceUrl,
  verifySafeStorage,
} = require('../security');
const { verifyPackagedComponents } = require('../resource-integrity');

test('renderer navigation is exact-origin only', () => {
  const origin = 'http://127.0.0.1:42123';
  assert.equal(isAllowedRendererNavigation(`${origin}/subjects?grade=7`, origin), true);
  for (const candidate of [
    'https://example.com', 'http://127.0.0.1:42124', 'file:///tmp/index.html',
    'data:text/html,test', 'javascript:alert(1)', 'http://user@127.0.0.1:42123', 'not a url',
  ]) assert.equal(isAllowedRendererNavigation(candidate, origin), false, candidate);
});

test('desktop v1 external URL allowlist denies every destination', () => {
  for (const candidate of ['https://maktab.af', 'https://support.maktab.af', 'http://maktab.af', 'file:///tmp/help']) {
    assert.equal(isAllowedExternalUrl(candidate), false, candidate);
  }
  assert.equal(isAllowedExternalUrl('https://support.maktab.af/help', ['https://support.maktab.af']), true);
  assert.equal(isAllowedExternalUrl('https://user@support.maktab.af/help', ['https://support.maktab.af']), false);
  assert.equal(isAllowedExternalUrl('https://sub.support.maktab.af/help', ['https://support.maktab.af']), false);
});

test('service URL normalization rejects credentials, queries, fragments, and insecure packaged URLs', () => {
  assert.equal(normalizeServiceUrl('https://release.maktab.af/v1/'), 'https://release.maktab.af/v1');
  assert.equal(normalizeServiceUrl('http://127.0.0.1:9000', { requireHttps: false }), 'http://127.0.0.1:9000');
  for (const value of ['http://release.maktab.af', 'https://user:pass@release.maktab.af', 'https://release.maktab.af?a=1', 'https://release.maktab.af/#x']) {
    assert.throws(() => normalizeServiceUrl(value), /invalid/);
  }
});

test('safeStorage self-test performs an encryption round trip', () => {
  const storage = {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(value).reverse(),
    decryptString: (value) => Buffer.from(value).reverse().toString(),
  };
  assert.deepEqual(verifySafeStorage(storage), { safeStorage: 'ok' });
  assert.throws(() => verifySafeStorage({ isEncryptionAvailable: () => false }), /unavailable/);
});

test('packaged component hashes detect tampering and path traversal', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-integrity-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, 'solver'));
  fs.mkdirSync(path.join(directory, 'app.asar.unpacked/node_modules/better-sqlite3/build/Release'), { recursive: true });
  const solverPath = path.join(directory, 'solver/solver');
  const sqlitePath = path.join(directory, 'app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node');
  fs.writeFileSync(solverPath, 'solver'); fs.writeFileSync(sqlitePath, 'sqlite');
  const digest = (value) => require('node:crypto').createHash('sha256').update(value).digest('hex');
  const manifestPath = path.join(directory, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    schemaVersion: 1, platform: process.platform,
    components: {
      betterSqlite3: { relativePath: path.relative(directory, sqlitePath), sha256: digest('sqlite') },
      solver: { relativePath: path.relative(directory, solverPath), sha256: digest('solver') },
    },
  }));
  assert.equal(await verifyPackagedComponents({ resourcesPath: directory, platform: process.platform, manifestPath }), true);
  fs.appendFileSync(solverPath, 'tampered');
  await assert.rejects(() => verifyPackagedComponents({ resourcesPath: directory, platform: process.platform, manifestPath }), /integrity/);
});
