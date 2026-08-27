const fs = require('node:fs');
const path = require('node:path');
const { normalizeServiceUrl } = require('./security');

const GITHUB_OWNER = 'Ahmadullah-github';
const GITHUB_REPOSITORY = 'maktab';
const RELEASE_CONFIG_KEYS = Object.freeze([
  'schemaVersion', 'distribution', 'version', 'buildId', 'commitSha', 'channel',
  'platform', 'arch', 'releaseApiUrl', 'updateFeed', 'trust',
]);

function exactObject(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function boundedString(value, minimum = 1, maximum = 256) {
  return typeof value === 'string' && value.length >= minimum && value.length <= maximum;
}

function stringArray(value, { minimum = 1, maximum = 16, pattern } = {}) {
  return Array.isArray(value)
    && value.length >= minimum
    && value.length <= maximum
    && new Set(value).size === value.length
    && value.every((item) => boundedString(item, 1, 256) && (!pattern || pattern.test(item)));
}

function parseReleaseConfig(value, { appVersion, platform = process.platform, arch = process.arch } = {}) {
  if (!exactObject(value, RELEASE_CONFIG_KEYS)) throw new Error('Release configuration has an invalid shape');
  if (value.schemaVersion !== 1) throw new Error('Release configuration schema is unsupported');
  if (!['internal', 'production'].includes(value.distribution)) throw new Error('Release distribution is invalid');
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value.version)) throw new Error('Release version is invalid');
  if (appVersion && value.version !== appVersion) throw new Error('Release version does not match the packaged application');
  if (!boundedString(value.buildId, 8, 128) || !/^[0-9A-Za-z.-]+$/.test(value.buildId)) throw new Error('Release build ID is invalid');
  if (!/^[a-f0-9]{40}$/.test(value.commitSha)) throw new Error('Release commit SHA is invalid');
  if (!['pilot', 'stable'].includes(value.channel)) throw new Error('Release channel is invalid');
  if (value.platform !== 'win32' || value.arch !== 'x64') throw new Error('Release target is invalid');
  if (platform !== 'win32' || arch !== 'x64') throw new Error('This release only supports Windows x64');
  value.releaseApiUrl = normalizeServiceUrl(value.releaseApiUrl, { requireHttps: true });

  if (!exactObject(value.updateFeed, ['provider', 'owner', 'repository', 'allowedOrigins'])) {
    throw new Error('Update feed configuration has an invalid shape');
  }
  if (
    value.updateFeed.provider !== 'github-release'
    || value.updateFeed.owner !== GITHUB_OWNER
    || value.updateFeed.repository !== GITHUB_REPOSITORY
    || !stringArray(value.updateFeed.allowedOrigins, { maximum: 8 })
  ) throw new Error('Update feed configuration is invalid');
  value.updateFeed.allowedOrigins = value.updateFeed.allowedOrigins.map((origin) => {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error('Update origin is invalid');
    }
    return parsed.origin;
  });

  if (!exactObject(value.trust, ['licenseKeyIds', 'updateKeyIds', 'authenticodePublishers'])) {
    throw new Error('Release trust configuration has an invalid shape');
  }
  const keyId = /^(?:license|update)-[a-z0-9][a-z0-9-]{2,63}$/;
  if (
    !stringArray(value.trust.licenseKeyIds, { pattern: keyId })
    || !stringArray(value.trust.updateKeyIds, { pattern: keyId })
    || !stringArray(value.trust.authenticodePublishers, { maximum: 4 })
  ) throw new Error('Release trust configuration is invalid');
  return Object.freeze(value);
}

function developmentConfig(app) {
  const version = app.getVersion();
  const channel = ['pilot', 'stable'].includes(process.env.MAKTAB_RELEASE_CHANNEL)
    ? process.env.MAKTAB_RELEASE_CHANNEL : 'pilot';
  return Object.freeze({
    schemaVersion: 1,
    distribution: 'internal',
    version,
    buildId: process.env.MAKTAB_BUILD_ID || `${version}-development`,
    commitSha: '0'.repeat(40),
    channel,
    platform: 'win32',
    arch: 'x64',
    releaseApiUrl: process.env.MAKTAB_RELEASE_API_URL || '',
    updateFeed: {
      provider: 'github-release', owner: GITHUB_OWNER, repository: GITHUB_REPOSITORY,
      allowedOrigins: ['https://github.com', 'https://objects.githubusercontent.com', 'https://release-assets.githubusercontent.com'],
    },
    trust: { licenseKeyIds: [], updateKeyIds: [], authenticodePublishers: [] },
  });
}

function loadReleaseConfig(app) {
  if (!app.isPackaged) return developmentConfig(app);
  const configPath = path.join(__dirname, 'release-config.json');
  let value;
  try { value = JSON.parse(fs.readFileSync(configPath, 'utf8')); }
  catch { throw new Error('Packaged release configuration is missing or invalid'); }
  return parseReleaseConfig(value, { appVersion: app.getVersion() });
}

module.exports = { GITHUB_OWNER, GITHUB_REPOSITORY, loadReleaseConfig, parseReleaseConfig };
