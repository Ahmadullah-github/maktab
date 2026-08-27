const assert = require('node:assert/strict');
const test = require('node:test');
const { parseReleaseConfig } = require('../release-config');
const { buildReleaseInputs } = require('../../../scripts/packaging/release-inputs');

function validConfig() {
  return {
    schemaVersion: 1,
    distribution: 'internal',
    version: '1.0.0',
    buildId: '1.0.0-pilot-internal-0123456789ab',
    commitSha: 'a'.repeat(40),
    channel: 'pilot',
    platform: 'win32',
    arch: 'x64',
    releaseApiUrl: 'https://127.0.0.1:4443',
    updateFeed: {
      provider: 'github-release', owner: 'Ahmadullah-github', repository: 'maktab',
      allowedOrigins: ['https://github.com'],
    },
    trust: {
      licenseKeyIds: ['license-internal'], updateKeyIds: ['update-internal'],
      authenticodePublishers: ['Maktab Internal Test'],
    },
  };
}

test('release config rejects unknown fields, insecure services, and target mismatches', () => {
  assert.equal(parseReleaseConfig(validConfig(), {
    appVersion: '1.0.0', platform: 'win32', arch: 'x64',
  }).buildId, validConfig().buildId);
  assert.throws(() => parseReleaseConfig({ ...validConfig(), unexpected: true }, {
    appVersion: '1.0.0', platform: 'win32', arch: 'x64',
  }), /shape/);
  assert.throws(() => parseReleaseConfig({ ...validConfig(), releaseApiUrl: 'http://release.example' }, {
    appVersion: '1.0.0', platform: 'win32', arch: 'x64',
  }), /URL/);
  assert.throws(() => parseReleaseConfig(validConfig(), {
    appVersion: '1.0.1', platform: 'win32', arch: 'x64',
  }), /does not match/);
});

test('internal release inputs are deterministic for a commit and do not need production secrets', () => {
  const prior = {
    distribution: process.env.MAKTAB_DISTRIBUTION,
    version: process.env.MAKTAB_RELEASE_VERSION,
  };
  process.env.MAKTAB_DISTRIBUTION = 'internal';
  delete process.env.MAKTAB_RELEASE_VERSION;
  try {
    const first = buildReleaseInputs().config;
    const second = buildReleaseInputs().config;
    assert.equal(first.buildId, second.buildId);
    assert.equal(first.commitSha, second.commitSha);
    assert.equal(first.distribution, 'internal');
  } finally {
    if (prior.distribution === undefined) delete process.env.MAKTAB_DISTRIBUTION;
    else process.env.MAKTAB_DISTRIBUTION = prior.distribution;
    if (prior.version === undefined) delete process.env.MAKTAB_RELEASE_VERSION;
    else process.env.MAKTAB_RELEASE_VERSION = prior.version;
  }
});
