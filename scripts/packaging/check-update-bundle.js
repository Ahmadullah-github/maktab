const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const distDirectory = path.resolve(process.argv[2] || path.join(projectRoot, 'dist-electron'));

function digest(filePath, algorithm, encoding) {
  assert.ok(fs.existsSync(filePath), `Missing release file: ${filePath}`);
  return crypto.createHash(algorithm).update(fs.readFileSync(filePath)).digest(encoding);
}

function verifySums(name, algorithm, encoding) {
  const lines = fs.readFileSync(path.join(distDirectory, name), 'utf8').trim().split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^(\S+)\s{2}(.+)$/);
    assert.ok(match, `Invalid ${name} entry`);
    assert.equal(digest(path.join(distDirectory, match[2]), algorithm, encoding), match[1], `${name} mismatch: ${match[2]}`);
  }
}

async function main() {
  const asar = await import('@electron/asar');
  const descriptorPath = path.join(distDirectory, 'release-descriptor.json');
  const descriptor = JSON.parse(fs.readFileSync(descriptorPath, 'utf8'));
  assert.deepEqual(Object.keys(descriptor).sort(), [
    'artifact', 'build_id', 'channel', 'minimum_supported_version', 'published_at',
    'release_config_sha256', 'release_notes', 'schema_version', 'updater_metadata', 'version',
  ].sort());
  assert.equal(descriptor.schema_version, 1);
  const artifactPath = path.join(distDirectory, descriptor.artifact.filename);
  const metadataName = new URL(descriptor.updater_metadata.url).pathname.split('/').pop();
  const metadataPath = path.join(distDirectory, metadataName);
  assert.equal(fs.statSync(artifactPath).size, descriptor.artifact.size);
  assert.equal(digest(artifactPath, 'sha256', 'hex'), descriptor.artifact.sha256);
  assert.equal(digest(artifactPath, 'sha512', 'base64'), descriptor.artifact.sha512);
  assert.equal(digest(metadataPath, 'sha256', 'hex'), descriptor.updater_metadata.sha256);
  const configBytes = asar.extractFile(
    path.join(distDirectory, 'win-unpacked', 'resources', 'app.asar'),
    'apps/desktop/release-config.json'
  );
  const config = JSON.parse(configBytes.toString('utf8'));
  assert.equal(crypto.createHash('sha256').update(configBytes).digest('hex'), descriptor.release_config_sha256);
  assert.equal(config.version, descriptor.version);
  assert.equal(config.buildId, descriptor.build_id);
  assert.equal(config.channel, descriptor.channel);
  assert.ok(config.trust.authenticodePublishers.includes(descriptor.artifact.authenticode_publisher));
  const componentManifest = asar.extractFile(
    path.join(distDirectory, 'win-unpacked', 'resources', 'app.asar'),
    'apps/desktop/component-integrity.json'
  );
  assert.deepEqual(
    fs.readFileSync(path.join(distDirectory, 'component-integrity-manifest.json')),
    componentManifest,
    'Published component integrity manifest differs from the protected ASAR copy'
  );
  verifySums('SHA256SUMS', 'sha256', 'hex');
  verifySums('SHA512SUMS', 'sha512', 'base64');
  const metadataText = fs.readFileSync(metadataPath, 'utf8');
  assert.match(metadataText, new RegExp(`version:\\s*["']?${descriptor.version.replaceAll('.', '\\.')}["']?`));
  assert.ok(metadataText.includes(descriptor.artifact.sha512), 'Updater metadata does not contain artifact SHA-512');
  console.log(`Update bundle verified: ${descriptor.build_id}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
