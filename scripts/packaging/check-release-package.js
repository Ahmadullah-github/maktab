const { spawnSync } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const arguments = process.argv.slice(2);
const portable = arguments.includes('--portable');
const directoryArgument = arguments.find((value) => !value.startsWith('--'));
const distDirectory = path.resolve(directoryArgument || path.join(projectRoot, 'dist-electron'));
const commands = [
  [process.execPath, [
    'scripts/packaging/check-packaged-desktop.js',
    '--package-dir', path.join(distDirectory, 'win-unpacked'),
    '--target-platform', 'win32',
  ]],
  [process.execPath, ['scripts/packaging/release-evidence.js', distDirectory]],
  [process.execPath, ['scripts/packaging/check-update-bundle.js', distDirectory]],
];
if (!portable) {
  commands.splice(2, 0, [process.execPath, ['scripts/packaging/check-windows-signatures.js', distDirectory]]);
} else {
  console.log('Portable release inspection: Authenticode policy verification is deferred to Windows.');
}
for (const [command, args] of commands) {
  const result = spawnSync(command, args, { cwd: projectRoot, env: process.env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
const expectedEvidence = [
  'release-descriptor.json', 'release-evidence.json',
  'component-integrity-manifest.json', 'SHA256SUMS', 'SHA512SUMS',
];
if (!portable) expectedEvidence.push('signature-evidence.json');
for (const name of expectedEvidence) {
  if (!require('node:fs').existsSync(path.join(distDirectory, name))) {
    throw new Error(`Release evidence is missing: ${name}`);
  }
}
