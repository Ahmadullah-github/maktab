const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..', '..');
const distDirectory = path.resolve(process.argv[2] || path.join(projectRoot, 'dist-electron'));

function hash(buffer, algorithm, encoding) {
  return crypto.createHash(algorithm).update(buffer).digest(encoding);
}

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Release artifact is missing: ${filePath}`);
  return fs.readFileSync(filePath);
}

async function main() {
  const asar = await import('@electron/asar');
  const asarPath = path.join(distDirectory, 'win-unpacked', 'resources', 'app.asar');
  const configBytes = asar.extractFile(asarPath, 'apps/desktop/release-config.json');
  const config = JSON.parse(configBytes.toString('utf8'));
  const metadataName = config.channel === 'stable' ? 'latest.yml' : 'pilot.yml';
  const artifactName = `Maktab-Timetable-${config.version}-x64.exe`;
  const metadataPath = path.join(distDirectory, metadataName);
  const artifactPath = path.join(distDirectory, artifactName);
  const metadata = read(metadataPath); const artifact = read(artifactPath);
  const releaseBase = `https://github.com/Ahmadullah-github/maktab/releases/download/v${config.version}`;
  const committedAt = spawnSync('git', ['show', '-s', '--format=%cI', config.commitSha], {
    cwd: projectRoot, encoding: 'utf8',
  }).stdout.trim();
  if (!committedAt) throw new Error('Could not resolve release commit timestamp');
  const descriptor = {
    schema_version: 1,
    channel: config.channel,
    version: config.version,
    build_id: config.buildId,
    published_at: committedAt,
    minimum_supported_version: process.env.MAKTAB_MINIMUM_SUPPORTED_VERSION || config.version,
    release_notes: process.env.MAKTAB_RELEASE_NOTES || '',
    release_config_sha256: hash(configBytes, 'sha256', 'hex'),
    updater_metadata: {
      url: `${releaseBase}/${metadataName}`,
      sha256: hash(metadata, 'sha256', 'hex'),
    },
    artifact: {
      filename: artifactName,
      url: `${releaseBase}/${artifactName}`,
      size: artifact.length,
      sha256: hash(artifact, 'sha256', 'hex'),
      sha512: hash(artifact, 'sha512', 'base64'),
      authenticode_publisher: config.trust.authenticodePublishers[0],
    },
  };
  const descriptorPath = path.join(distDirectory, 'release-descriptor.json');
  fs.writeFileSync(descriptorPath, `${JSON.stringify(descriptor, null, 2)}\n`);
  const componentManifest = asar.extractFile(
    asarPath,
    'apps/desktop/component-integrity.json'
  );
  const componentManifestPath = path.join(distDirectory, 'component-integrity-manifest.json');
  fs.writeFileSync(componentManifestPath, componentManifest);
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const blockmapName = `${artifactName}.blockmap`;
  const evidenceFiles = [
    artifactName,
    blockmapName,
    metadataName,
    'release-descriptor.json',
    'component-integrity-manifest.json',
    path.join('win-unpacked', 'Maktab Timetable.exe'),
    path.join('win-unpacked', 'resources', 'app.asar'),
    path.join('win-unpacked', 'resources', 'solver', 'solver.exe'),
  ];
  const artifacts = Object.fromEntries(evidenceFiles.map((name) => {
    const bytes = read(path.join(distDirectory, name));
    return [name.replaceAll('\\', '/'), {
      size: bytes.length,
      sha256: hash(bytes, 'sha256', 'hex'),
      sha512: hash(bytes, 'sha512', 'base64'),
    }];
  }));
  const evidence = {
    schemaVersion: 1,
    distribution: config.distribution,
    buildId: config.buildId,
    commitSha: config.commitSha,
    runner: { platform: process.platform, arch: process.arch, node: process.version },
    toolchain: {
      electron: packageJson.devDependencies.electron,
      electronBuilder: packageJson.devDependencies['electron-builder'],
      electronUpdater: packageJson.dependencies['electron-updater'],
    },
    artifacts,
  };
  fs.writeFileSync(path.join(distDirectory, 'release-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  fs.writeFileSync(path.join(distDirectory, 'SHA256SUMS'), `${Object.entries(artifacts).map(([name, value]) => `${value.sha256}  ${name}`).join('\n')}\n`);
  fs.writeFileSync(path.join(distDirectory, 'SHA512SUMS'), `${Object.entries(artifacts).map(([name, value]) => `${value.sha512}  ${name}`).join('\n')}\n`);
  console.log(`Release evidence generated for ${config.buildId}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
