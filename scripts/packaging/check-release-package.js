const { spawnSync } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const distDirectory = path.resolve(process.argv[2] || path.join(projectRoot, 'dist-electron'));
const commands = [
  [process.execPath, ['scripts/packaging/check-packaged-desktop.js', '--package-dir', path.join(distDirectory, 'win-unpacked')]],
  [process.execPath, ['scripts/packaging/release-evidence.js', distDirectory]],
  [process.execPath, ['scripts/packaging/check-windows-signatures.js', distDirectory]],
  [process.execPath, ['scripts/packaging/check-update-bundle.js', distDirectory]],
];
for (const [command, args] of commands) {
  const result = spawnSync(command, args, { cwd: projectRoot, env: process.env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
for (const name of [
  'release-descriptor.json', 'release-evidence.json', 'signature-evidence.json',
  'component-integrity-manifest.json', 'SHA256SUMS', 'SHA512SUMS',
]) {
  if (!require('node:fs').existsSync(path.join(distDirectory, name))) {
    throw new Error(`Release evidence is missing: ${name}`);
  }
}
