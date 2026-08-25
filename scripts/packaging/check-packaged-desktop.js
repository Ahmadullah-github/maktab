const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { verifyPackagedComponents } = require('../../apps/desktop/resource-integrity');
const { parseKeyRing } = require('../../apps/desktop/trusted-keys');

const projectRoot = path.resolve(__dirname, '..', '..');

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function defaultPackageDirectory() {
  if (process.platform === 'win32') return path.join(projectRoot, 'dist-electron', 'win-unpacked');
  if (process.platform === 'darwin') return path.join(projectRoot, 'dist-electron', 'mac', 'Maktab Timetable.app');
  return path.join(projectRoot, 'dist-electron', 'linux-unpacked');
}

function findExecutable(packageDirectory) {
  if (process.platform === 'darwin') return path.join(packageDirectory, 'Contents', 'MacOS', 'Maktab Timetable');
  const entries = fs.readdirSync(packageDirectory, { withFileTypes: true });
  if (process.platform === 'win32') {
    const executable = entries.find((entry) => entry.isFile() && entry.name.endsWith('.exe') && !/^unins/i.test(entry.name));
    if (!executable) throw new Error('Packaged Windows executable was not found');
    return path.join(packageDirectory, executable.name);
  }
  const executable = entries
    .filter((entry) => entry.isFile() && (fs.statSync(path.join(packageDirectory, entry.name)).mode & 0o111))
    .sort((left, right) => (
      fs.statSync(path.join(packageDirectory, right.name)).size
      - fs.statSync(path.join(packageDirectory, left.name)).size
    ))[0];
  if (!executable) throw new Error('Packaged Linux executable was not found');
  return path.join(packageDirectory, executable.name);
}

async function main() {
  const packageDirectory = path.resolve(argument('--package-dir') || defaultPackageDirectory());
  assert.ok(fs.existsSync(packageDirectory), `Packaged desktop directory does not exist: ${packageDirectory}`);
  const resourcesPath = process.platform === 'darwin'
    ? path.join(packageDirectory, 'Contents', 'Resources')
    : path.join(packageDirectory, 'resources');
  const executablePath = findExecutable(packageDirectory);
  const asarPath = path.join(resourcesPath, 'app.asar');
  assert.ok(fs.existsSync(asarPath), 'app.asar is missing');
  assert.equal(fs.existsSync(path.join(resourcesPath, 'app')), false, 'Loose application code exists outside ASAR');

  const [{ getCurrentFuseWire, FuseState, FuseV1Options }, asar] = await Promise.all([
    import('@electron/fuses'), import('@electron/asar'),
  ]);
  const wire = await getCurrentFuseWire(executablePath);
  const expected = new Map([
    [FuseV1Options.RunAsNode, FuseState.DISABLE],
    [FuseV1Options.EnableCookieEncryption, FuseState.ENABLE],
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable, FuseState.DISABLE],
    [FuseV1Options.EnableNodeCliInspectArguments, FuseState.DISABLE],
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation, FuseState.ENABLE],
    [FuseV1Options.OnlyLoadAppFromAsar, FuseState.ENABLE],
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot, FuseState.DISABLE],
    [FuseV1Options.GrantFileProtocolExtraPrivileges, FuseState.DISABLE],
  ]);
  for (const [fuse, state] of expected) assert.equal(wire[fuse], state, `Unexpected fuse state: ${FuseV1Options[fuse]}`);

  const files = asar.listPackage(asarPath).map((entry) => entry.replace(/^\//, ''));
  const forbidden = [
    /\.map$/, /(^|\/)tests?\//, /^services\/(platform-api|release-api)\//,
    /^node_modules\/(electron|electron-builder|typescript|vite|vitest|playwright|@electron\/fuses)\//,
  ];
  for (const file of files) {
    for (const pattern of forbidden) assert.doesNotMatch(file, pattern, `Forbidden packaged file: ${file}`);
  }
  for (const [name, purpose] of [['license-public-keys.json', 'License'], ['update-public-keys.json', 'Update']]) {
    const internalPath = `apps/desktop/${name}`;
    assert.ok(files.includes(internalPath), `${name} is missing from the integrity-protected ASAR`);
    assert.equal(fs.existsSync(path.join(resourcesPath, name)), false, `${name} must not be a mutable external resource`);
    const ring = parseKeyRing(asar.extractFile(asarPath, internalPath).toString('utf8'), purpose);
    assert.ok(Object.keys(ring).length > 0, `${name} has no trusted keys`);
  }

  const manifestBuffer = asar.extractFile(asarPath, 'apps/desktop/component-integrity.json');
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-package-check-'));
  try {
    const manifestPath = path.join(temporaryDirectory, 'component-integrity.json');
    fs.writeFileSync(manifestPath, manifestBuffer);
    await verifyPackagedComponents({ resourcesPath, platform: process.platform, manifestPath });
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
  console.log(`Packaged desktop verified: ${packageDirectory}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
