const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

if (process.platform !== 'win32') throw new Error('Authenticode verification requires Windows');
const projectRoot = path.resolve(__dirname, '..', '..');
const distDirectory = path.resolve(process.argv[2] || path.join(projectRoot, 'dist-electron'));
const descriptor = JSON.parse(fs.readFileSync(path.join(distDirectory, 'release-descriptor.json'), 'utf8'));
const expectedPublisher = descriptor.artifact.authenticode_publisher;
const kitsRoot = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Windows Kits', '10', 'bin');
const signTool = fs.readdirSync(kitsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(kitsRoot, entry.name, 'x64', 'signtool.exe'))
  .filter((candidate) => fs.existsSync(candidate))
  .sort().at(-1);
assert.ok(signTool, 'SignTool was not found in the Windows SDK');
const powerShell = 'pwsh.exe';
const signatureInspector = path.join(projectRoot, 'scripts', 'packaging', 'inspect-authenticode.ps1');
assert.ok(fs.existsSync(signatureInspector), 'Authenticode inspection script was not found');
const powerShellCheck = spawnSync(powerShell, [
  '-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
  'Import-Module Microsoft.PowerShell.Security -ErrorAction Stop; $PSVersionTable.PSVersion.ToString()',
], { encoding: 'utf8' });
if (powerShellCheck.error) throw powerShellCheck.error;
assert.equal(
  powerShellCheck.status,
  0,
  powerShellCheck.stderr || powerShellCheck.stdout || 'PowerShell 7 security module is unavailable'
);
const targets = [
  path.join(distDirectory, descriptor.artifact.filename),
  path.join(distDirectory, 'win-unpacked', 'Maktab Timetable.exe'),
  path.join(distDirectory, 'win-unpacked', 'resources', 'elevate.exe'),
  path.join(distDirectory, 'win-unpacked', 'resources', 'solver', 'solver.exe'),
];
const evidence = [];

for (const target of targets) {
  assert.ok(fs.existsSync(target), `Signed binary is missing: ${target}`);
  const policyCheck = spawnSync(signTool, ['verify', '/pa', '/all', '/v', '/tw', target], { encoding: 'utf8' });
  assert.equal(policyCheck.status, 0, policyCheck.stdout || policyCheck.stderr || `SignTool /pa failed: ${target}`);
  const result = spawnSync(powerShell, [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', signatureInspector, '-FilePath', target,
  ], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Signature inspection failed: ${target}`);
  }
  const signature = JSON.parse(result.stdout.trim());
  assert.equal(
    signature.Status,
    'Valid',
    `Invalid Authenticode signature: ${target} (${signature.StatusMessage || signature.Status || 'unknown status'})`
  );
  const publisherMatches = signature.Subject === expectedPublisher
    || signature.Subject.split(',')[0].trim() === `CN=${expectedPublisher}`;
  assert.ok(publisherMatches, `Wrong Authenticode publisher: ${target}`);
  assert.match(signature.Thumbprint, /^[A-F0-9]{40,64}$/i);
  assert.match(signature.TimestampThumbprint, /^[A-F0-9]{40,64}$/i, `Missing RFC3161 timestamp: ${target}`);
  evidence.push({
    file: path.relative(distDirectory, target).replaceAll('\\', '/'),
    status: signature.Status,
    subject: signature.Subject,
    signerThumbprint: signature.Thumbprint,
    timestampThumbprint: signature.TimestampThumbprint,
    signToolPolicy: '/pa /all /tw',
  });
}
fs.writeFileSync(path.join(distDirectory, 'signature-evidence.json'), `${JSON.stringify({
  schemaVersion: 1,
  expectedPublisher,
  signatures: evidence,
}, null, 2)}\n`);
console.log(`Verified Authenticode publisher and timestamp on ${targets.length} binaries.`);
