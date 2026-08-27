const assert = require('node:assert/strict');
const test = require('node:test');
const {
  compareVersions, isRolloutEligible, parseSignedManifest, rolloutBucket, validateUpdaterInfo,
} = require('../update-contract');
const { parseReleaseConfig } = require('../release-config');
const { getRuntimeInfo } = require('../runtime');

const version = '1.0.1';
const filename = `Maktab-Timetable-${version}-x64.exe`;
const releaseDirectory = `https://github.com/Ahmadullah-github/maktab/releases/download/v${version}/`;

function manifest(overrides = {}) {
  return {
    schema_version: 2,
    channel: 'pilot',
    version,
    build_id: '1.0.1-pilot-0123456789ab',
    published_at: '2026-08-26T00:00:00Z',
    minimum_supported_version: '1.0.0',
    rollout_percent: 25,
    release_notes: 'Pilot',
    updater_metadata: { url: `${releaseDirectory}pilot.yml`, sha256: 'a'.repeat(64) },
    artifacts: [{
      filename, url: `${releaseDirectory}${filename}`, size: 100,
      sha256: 'b'.repeat(64), sha512: `${'A'.repeat(86)}==`,
      authenticode_publisher: 'Maktab Software',
    }],
    key_id: 'update-current',
    signature: 'A'.repeat(86),
    ...overrides,
  };
}

const options = {
  channel: 'pilot',
  allowedOrigins: ['https://github.com'],
  acceptedPublishers: ['Maktab Software'],
  acceptedKeyIds: ['update-current'],
};

test('electron-updater compatibility keeps deterministic version ordering', () => {
  assert.equal(compareVersions('43.4.1', '43.4.0'), 1);
  assert.equal(compareVersions('1.0.0', '1.0'), 0);
  assert.equal(compareVersions('1.0.0', '1.0.1'), -1);
});

test('signed manifest v2 binds exact metadata, artifact, publisher, and key identity', () => {
  const parsed = parseSignedManifest(manifest(), options);
  assert.equal(parsed.artifacts[0].filename, filename);
  assert.throws(() => parseSignedManifest({ ...manifest(), unexpected: true }, options), /shape/);
  assert.throws(() => parseSignedManifest(manifest({ key_id: 'update-attacker' }), options), /identity/);
  assert.throws(() => parseSignedManifest(manifest({
    artifacts: [{ ...manifest().artifacts[0], authenticode_publisher: 'Wrong Publisher' }],
  }), options), /identity/);
  assert.throws(() => parseSignedManifest(manifest({
    updater_metadata: { ...manifest().updater_metadata, url: 'https://example.com/pilot.yml' },
  }), options), /trusted/);
  assert.throws(() => parseSignedManifest(manifest({
    artifacts: [{
      ...manifest().artifacts[0],
      url: `https://github.com/Ahmadullah-github/maktab/releases/download/v9.9.9/${filename}`,
    }],
  }), options), /share an immutable release directory/);
});

test('updater metadata must identify the exact signed artifact', () => {
  assert.equal(validateUpdaterInfo({
    version,
    files: [{ url: filename, sha512: `${'A'.repeat(86)}==`, size: 100 }],
  }, manifest()), true);
  assert.throws(() => validateUpdaterInfo({
    version,
    files: [{ url: filename, sha512: `${'B'.repeat(86)}==`, size: 100 }],
  }, manifest()), /artifact metadata/);
});

test('rollout is stable per device and honors zero and full boundaries', () => {
  const device = 'device-identifier-0000000000000001';
  assert.equal(rolloutBucket(device, 'pilot'), rolloutBucket(device, 'pilot'));
  assert.equal(isRolloutEligible(device, 'pilot', 0), false);
  assert.equal(isRolloutEligible(device, 'pilot', 100), true);
  const selected = Array.from({ length: 200 }, (_, index) => (
    isRolloutEligible(`device-identifier-${String(index).padStart(24, '0')}`, 'pilot', 25)
  )).filter(Boolean).length;
  assert.ok(selected >= 25 && selected <= 75, `unexpected deterministic cohort size: ${selected}`);
});

test('packaged runtime ignores environment build and channel overrides', () => {
  const priorBuild = process.env.MAKTAB_BUILD_ID; const priorChannel = process.env.MAKTAB_RELEASE_CHANNEL;
  process.env.MAKTAB_BUILD_ID = 'attacker'; process.env.MAKTAB_RELEASE_CHANNEL = 'stable';
  try {
    const config = parseReleaseConfig({
      schemaVersion: 1,
      distribution: 'production',
      version: '1.0.0',
      buildId: '1.0.0-pilot-0123456789ab',
      commitSha: 'a'.repeat(40),
      channel: 'pilot',
      platform: 'win32',
      arch: 'x64',
      releaseApiUrl: 'https://release.example.com',
      updateFeed: {
        provider: 'github-release', owner: 'Ahmadullah-github', repository: 'maktab',
        allowedOrigins: ['https://github.com'],
      },
      trust: {
        licenseKeyIds: ['license-current'], updateKeyIds: ['update-current'],
        authenticodePublishers: ['Maktab Software'],
      },
    }, { appVersion: '1.0.0', platform: 'win32', arch: 'x64' });
    const runtime = getRuntimeInfo({ isPackaged: true, getVersion: () => '1.0.0' }, config);
    assert.equal(runtime.buildId, config.buildId);
    assert.equal(runtime.channel, 'pilot');
  } finally {
    if (priorBuild === undefined) delete process.env.MAKTAB_BUILD_ID; else process.env.MAKTAB_BUILD_ID = priorBuild;
    if (priorChannel === undefined) delete process.env.MAKTAB_RELEASE_CHANNEL; else process.env.MAKTAB_RELEASE_CHANNEL = priorChannel;
  }
});
