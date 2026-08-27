const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const afterPack = require('../../../scripts/packaging/after-pack').default;

test('afterPack validates without modifying the integrity-protected ASAR', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-after-pack-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source');
  const appOutDir = path.join(root, 'output');
  const resourcesPath = path.join(appOutDir, 'resources');
  const nativeDirectory = path.join(source, 'node_modules', 'native-addon', 'build');
  fs.mkdirSync(nativeDirectory, { recursive: true });
  fs.mkdirSync(resourcesPath, { recursive: true });
  fs.writeFileSync(path.join(source, 'package.json'), '{"name":"packaging-hook-fixture"}');
  fs.writeFileSync(path.join(nativeDirectory, 'addon.node'), 'native');

  const asar = await import('@electron/asar');
  const asarPath = path.join(resourcesPath, 'app.asar');
  await asar.createPackageWithOptions(source, asarPath, { unpack: '**/*.node' });
  const digest = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  const nativePath = path.join(`${asarPath}.unpacked`, 'node_modules', 'native-addon', 'build', 'addon.node');
  const originalAsarHash = digest(asarPath);
  const originalNativeHash = digest(nativePath);

  const originalRename = fs.renameSync;
  fs.renameSync = () => assert.fail('afterPack must not rename integrity-protected package files');
  try {
    await afterPack({ electronPlatformName: 'win32', appOutDir });
  } finally {
    fs.renameSync = originalRename;
  }

  assert.equal(digest(asarPath), originalAsarHash);
  assert.equal(digest(nativePath), originalNativeHash);
});

test('afterPack rejects source maps and test directories left in the ASAR', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-after-pack-invalid-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source');
  const appOutDir = path.join(root, 'output');
  const resourcesPath = path.join(appOutDir, 'resources');
  fs.mkdirSync(path.join(source, 'tests'), { recursive: true });
  fs.mkdirSync(resourcesPath, { recursive: true });
  fs.writeFileSync(path.join(source, 'tests', 'fixture.js'), 'test');
  fs.writeFileSync(path.join(source, 'bundle.js.map'), 'map');
  const asar = await import('@electron/asar');
  await asar.createPackage(source, path.join(resourcesPath, 'app.asar'));
  await assert.rejects(
    () => afterPack({ electronPlatformName: 'win32', appOutDir }),
    /Forbidden development files were packaged/
  );
});
