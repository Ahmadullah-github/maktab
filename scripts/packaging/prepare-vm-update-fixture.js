const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { canonicalManifest } = require('../../apps/desktop/update-contract');

const root = path.resolve(__dirname, '..', '..');
const pair = path.join(root, 'release-pair');
const target = path.join(pair, 'v1.0.1');
const descriptor = JSON.parse(fs.readFileSync(path.join(target, 'release-descriptor.json'), 'utf8'));
const metadataName = descriptor.channel === 'stable' ? 'latest.yml' : 'pilot.yml';
const metadata = fs.readFileSync(path.join(target, metadataName));
const origin = 'https://updates.internal.maktab.test:4443';
const releasePath = `/releases/download/v${descriptor.version}`;
const manifest = {
  schema_version: 2,
  channel: descriptor.channel,
  version: descriptor.version,
  build_id: descriptor.build_id,
  published_at: descriptor.published_at,
  minimum_supported_version: descriptor.minimum_supported_version,
  rollout_percent: 100,
  release_notes: 'Disposable Windows 10 acceptance update',
  updater_metadata: {
    url: `${origin}${releasePath}/${metadataName}`,
    sha256: crypto.createHash('sha256').update(metadata).digest('hex'),
  },
  artifacts: [{ ...descriptor.artifact, url: `${origin}${releasePath}/${descriptor.artifact.filename}` }],
  key_id: process.env.MAKTAB_INTERNAL_UPDATE_KEY_ID,
};
if (!manifest.key_id || !process.env.MAKTAB_INTERNAL_UPDATE_PRIVATE_KEY) {
  throw new Error('The disposable update signing key is missing');
}
const updatePrivateKey = fs.readFileSync(process.env.MAKTAB_INTERNAL_UPDATE_PRIVATE_KEY);
const sign = (value) => crypto.sign(null, canonicalManifest(value), updatePrivateKey).toString('base64url');
manifest.signature = sign(manifest);
fs.writeFileSync(path.join(target, 'signed-update-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const wrongPublisher = structuredClone(manifest);
delete wrongPublisher.signature;
wrongPublisher.artifacts[0].authenticode_publisher = 'Maktab Wrong Publisher Test';
wrongPublisher.signature = sign(wrongPublisher);
fs.writeFileSync(
  path.join(target, 'signed-update-manifest-wrong-publisher.json'),
  `${JSON.stringify(wrongPublisher, null, 2)}\n`
);
const tamperedManifest = structuredClone(manifest);
tamperedManifest.signature = `${tamperedManifest.signature.slice(0, -1)}${tamperedManifest.signature.endsWith('A') ? 'B' : 'A'}`;
fs.writeFileSync(
  path.join(target, 'signed-update-manifest-tampered.json'),
  `${JSON.stringify(tamperedManifest, null, 2)}\n`
);
fs.writeFileSync(path.join(target, 'acceptance-scenario.txt'), 'normal\n');

const fixture = path.join(pair, 'acceptance-server');
fs.mkdirSync(fixture, { recursive: true });
fs.copyFileSync(process.env.MAKTAB_INTERNAL_TLS_PFX, path.join(fixture, 'internal-tls.pfx'));
fs.copyFileSync(
  process.env.MAKTAB_INTERNAL_TLS_CERTIFICATE,
  path.join(fixture, 'internal-tls.cer')
);
fs.copyFileSync(
  process.env.MAKTAB_INTERNAL_CERTIFICATE,
  path.join(fixture, 'internal-code-signing.cer')
);
if (!process.env.MAKTAB_INTERNAL_CA_CERTIFICATE) throw new Error('The disposable test CA is missing');
fs.copyFileSync(
  process.env.MAKTAB_INTERNAL_CA_CERTIFICATE,
  path.join(fixture, 'internal-test-ca.cer')
);
if (!process.env.MAKTAB_INTERNAL_LICENSE_PRIVATE_KEY || !process.env.MAKTAB_INTERNAL_LICENSE_KEY_ID) {
  throw new Error('The disposable license signing key is missing');
}
fs.copyFileSync(
  process.env.MAKTAB_INTERNAL_LICENSE_PRIVATE_KEY,
  path.join(fixture, 'internal-license-private.pem')
);
const qaLicenseKey = `MKT-QA-${crypto.randomBytes(24).toString('base64url')}`;
fs.writeFileSync(path.join(fixture, 'internal-qa-license.txt'), `${qaLicenseKey}\n`, { mode: 0o600 });
fs.writeFileSync(path.join(fixture, 'internal-server-config.json'), `${JSON.stringify({
  schemaVersion: 1,
  licenseKeyId: process.env.MAKTAB_INTERNAL_LICENSE_KEY_ID,
  qaLicenseKey,
}, null, 2)}\n`, { mode: 0o600 });
fs.writeFileSync(
  path.join(fixture, 'internal-tls-password.txt'),
  `${process.env.MAKTAB_INTERNAL_TLS_PASSWORD}\n`,
  { mode: 0o600 }
);
fs.writeFileSync(path.join(fixture, 'README.txt'), [
  'DISPOSABLE INTERNAL ACCEPTANCE TRUST MATERIAL — NEVER PUBLISH.',
  'This directory contains a disposable QA license signer for the internal-only acceptance server.',
  'It is never embedded in an application package and must be deleted when the seven-day artifact expires.',
  'On the host, map updates.internal.maktab.test to 127.0.0.1 and run:',
  '  MAKTAB_INTERNAL_UPDATE_BIND=0.0.0.0 node scripts/packaging/internal-update-server.js release-pair/v1.0.1',
  'In the VirtualBox NAT guest, map updates.internal.maktab.test to 10.0.2.2.',
  'Import internal-test-ca.cer as a trusted root and internal-code-signing.cer as a trusted publisher only after the clean acceptance snapshot.',
  'Use internal-qa-license.txt for the acceptance activation step.',
].join('\n'));
console.log(`Disposable VM update fixture prepared at ${fixture}`);
