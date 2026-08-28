const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { verifyPackagedComponents } = require('../../apps/desktop/resource-integrity');
const { parseKeyRing } = require('../../apps/desktop/trusted-keys');
const { parseReleaseConfig } = require('../../apps/desktop/release-config');
const { normalizeAsarEntry, toHostAsarPath } = require('./asar-path');

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

function findExecutable(packageDirectory, targetPlatform) {
  if (targetPlatform === 'darwin') return path.join(packageDirectory, 'Contents', 'MacOS', 'Maktab Timetable');
  const entries = fs.readdirSync(packageDirectory, { withFileTypes: true });
  if (targetPlatform === 'win32') {
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
  const targetPlatform = argument('--target-platform')
    || (path.basename(packageDirectory) === 'win-unpacked' ? 'win32' : process.platform);
  assert.ok(['win32', 'linux', 'darwin'].includes(targetPlatform), `Unsupported target platform: ${targetPlatform}`);
  assert.ok(fs.existsSync(packageDirectory), `Packaged desktop directory does not exist: ${packageDirectory}`);
  const resourcesPath = targetPlatform === 'darwin'
    ? path.join(packageDirectory, 'Contents', 'Resources')
    : path.join(packageDirectory, 'resources');
  const executablePath = findExecutable(packageDirectory, targetPlatform);
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

  const files = asar.listPackage(asarPath).map(normalizeAsarEntry);
  const forbidden = [
    /\.map$/, /(^|\/)tests?\//, /^services\/(platform-api|release-api)\//,
    /^node_modules\/(electron|electron-builder|typescript|vite|vitest|playwright|@electron\/fuses)\//,
  ];
  for (const file of files) {
    for (const pattern of forbidden) assert.doesNotMatch(file, pattern, `Forbidden packaged file: ${file}`);
    assert.doesNotMatch(file, /(^|\/)(?:.*private.*key|.*\.pfx|.*\.p12|.*\.pem)$/i, `Private key material is packaged: ${file}`);
  }
  const packageLock = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package-lock.json'), 'utf8'));
  const packageEntries = Object.entries(packageLock.packages || {});
  const dependenciesByName = new Map();
  for (const [lockPath, metadata] of packageEntries) {
    let name = metadata.name;
    if (!name && lockPath.includes('node_modules/')) name = lockPath.split('node_modules/').pop();
    if (!name) continue;
    const dependencies = new Set([
      ...Object.keys(metadata.dependencies || {}),
      ...Object.keys(metadata.optionalDependencies || {}),
    ]);
    if (!dependenciesByName.has(name)) dependenciesByName.set(name, new Set());
    for (const dependency of dependencies) dependenciesByName.get(name).add(dependency);
  }
  const rootDependencies = Object.keys(JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')).dependencies || {});
  const allowedPackages = new Set(); const pending = [...rootDependencies];
  while (pending.length) {
    const name = pending.pop();
    if (allowedPackages.has(name)) continue;
    allowedPackages.add(name);
    for (const dependency of dependenciesByName.get(name) || []) pending.push(dependency);
  }
  const packagedPackages = new Set(
    files
      .filter((file) => file.startsWith('node_modules/'))
      .map((file) => {
        const parts = file.split('/');
        if (parts[1].startsWith('@')) return parts[2] ? `${parts[1]}/${parts[2]}` : null;
        return parts[1] || null;
      })
      .filter(Boolean)
  );
  for (const packageName of packagedPackages) {
    assert.ok(allowedPackages.has(packageName), `Unexpected runtime dependency was packaged: ${packageName}`);
  }
  for (const packageName of rootDependencies) {
    if (packageName === '@maktab/local-api') {
      assert.ok(files.includes('services/local-api/package.json'), 'The local API workspace is missing');
    } else {
      assert.ok(packagedPackages.has(packageName), `Required runtime dependency is missing: ${packageName}`);
    }
  }
  for (const [name, purpose] of [['license-public-keys.json', 'License'], ['update-public-keys.json', 'Update']]) {
    const internalPath = `apps/desktop/${name}`;
    assert.ok(files.includes(internalPath), `${name} is missing from the integrity-protected ASAR`);
    assert.equal(fs.existsSync(path.join(resourcesPath, name)), false, `${name} must not be a mutable external resource`);
    const ring = parseKeyRing(asar.extractFile(asarPath, toHostAsarPath(internalPath)).toString('utf8'), purpose);
    assert.ok(Object.keys(ring).length > 0, `${name} has no trusted keys`);
  }
  const releaseConfig = parseReleaseConfig(
    JSON.parse(asar.extractFile(asarPath, toHostAsarPath('apps/desktop/release-config.json')).toString('utf8')),
    { appVersion: JSON.parse(asar.extractFile(asarPath, toHostAsarPath('package.json')).toString('utf8')).version, platform: 'win32', arch: 'x64' }
  );
  assert.equal(releaseConfig.commitSha.length, 40);
  assert.ok(releaseConfig.trust.licenseKeyIds.length > 0);
  assert.ok(releaseConfig.trust.updateKeyIds.length > 0);

  const manifestBuffer = asar.extractFile(asarPath, toHostAsarPath('apps/desktop/component-integrity.json'));
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-package-check-'));
  try {
    const manifestPath = path.join(temporaryDirectory, 'component-integrity.json');
    fs.writeFileSync(manifestPath, manifestBuffer);
    await verifyPackagedComponents({ resourcesPath, platform: targetPlatform, manifestPath });
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
  const unexpectedExecutables = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.name.toLowerCase().endsWith('.exe') && !entryPath.endsWith(path.join('solver', 'solver.exe'))) {
        unexpectedExecutables.push(path.relative(resourcesPath, entryPath));
      }
    }
  };
  visit(resourcesPath);
  assert.deepEqual(unexpectedExecutables, [], `Unexpected executable resources: ${unexpectedExecutables.join(', ')}`);
  console.log(`Packaged desktop verified: ${packageDirectory}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
