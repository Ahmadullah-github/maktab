const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseReleaseConfig } = require('../../apps/desktop/release-config');

const projectRoot = path.resolve(__dirname, '..', '..');
const stagingRoot = path.join(projectRoot, '.release-staging');
const desktopStaging = path.join(stagingRoot, 'apps', 'desktop');

function git(...args) {
  const result = spawnSync('git', args, { cwd: projectRoot, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed`);
  return result.stdout.trim();
}

function readPackage() {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
}

function parseRing(raw, prefix, name) {
  let ring;
  try { ring = JSON.parse(raw); } catch { throw new Error(`${name} public key ring is invalid JSON`); }
  if (ring?.schema_version !== 1 || !Array.isArray(ring.keys) || ring.keys.length < 1) {
    throw new Error(`${name} public key ring has an invalid schema`);
  }
  const ids = [];
  for (const entry of ring.keys) {
    if (
      !entry || typeof entry.key_id !== 'string' || !entry.key_id.startsWith(`${prefix}-`)
      || !/^[a-z0-9-]{4,72}$/.test(entry.key_id) || ids.includes(entry.key_id)
      || typeof entry.public_key !== 'string' || !entry.public_key.includes('PUBLIC KEY')
    ) throw new Error(`${name} public key ring contains an invalid entry`);
    ids.push(entry.key_id);
  }
  return { ring, ids };
}

function ephemeralRing(prefix) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const keyId = `${prefix}-internal-${crypto.randomBytes(6).toString('hex')}`;
  return {
    ring: {
      schema_version: 1,
      keys: [{ key_id: keyId, public_key: publicKey.export({ type: 'spki', format: 'pem' }) }],
    },
    ids: [keyId],
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

function loadRing(prefix, distribution) {
  const name = `${prefix}-public-keys.json`;
  const envName = `MAKTAB_${prefix.toUpperCase()}_PUBLIC_KEYS_JSON`;
  const filePath = path.join(projectRoot, 'release-keys', name);
  if (process.env[envName]) return parseRing(process.env[envName], prefix, prefix);
  if (fs.existsSync(filePath)) return parseRing(fs.readFileSync(filePath, 'utf8'), prefix, prefix);
  if (distribution === 'production') throw new Error(`Production ${prefix} public key ring is missing`);
  return ephemeralRing(prefix);
}

function validateProductionSource(version, commitSha) {
  const tag = process.env.GITHUB_REF_NAME || git('tag', '--points-at', 'HEAD').split('\n').find(Boolean);
  if (tag !== `v${version}`) throw new Error(`Production release must build tag v${version}`);
  if (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== commitSha) throw new Error('GitHub release SHA does not match HEAD');
  const contained = git('branch', '-r', '--contains', 'HEAD').split('\n').map((line) => line.trim());
  if (!contained.some((line) => line === 'origin/main')) throw new Error('Production release commit is not contained in origin/main');
  if (git('status', '--porcelain')) throw new Error('Production release checkout is dirty');
}

function buildReleaseInputs({ write = false } = {}) {
  const packageJson = readPackage();
  const version = process.env.MAKTAB_RELEASE_VERSION || packageJson.version;
  const distribution = process.env.MAKTAB_DISTRIBUTION || 'internal';
  const channel = process.env.MAKTAB_RELEASE_CHANNEL || 'pilot';
  if (!['internal', 'production'].includes(distribution)) throw new Error('MAKTAB_DISTRIBUTION must be internal or production');
  if (!['pilot', 'stable'].includes(channel)) throw new Error('MAKTAB_RELEASE_CHANNEL must be pilot or stable');
  if (distribution === 'production' && version !== packageJson.version) throw new Error('Production version overrides are forbidden');
  const commitSha = git('rev-parse', 'HEAD').toLowerCase();
  if (distribution === 'production') validateProductionSource(version, commitSha);

  const releaseApiUrl = process.env.MAKTAB_RELEASE_API_URL
    || (distribution === 'internal' ? 'https://updates.internal.maktab.test:4443' : '');
  if (!releaseApiUrl) throw new Error('MAKTAB_RELEASE_API_URL is required for production');
  const license = loadRing('license', distribution);
  const update = loadRing('update', distribution);
  const publisher = process.env.MAKTAB_AUTHENTICODE_PUBLISHER
    || (distribution === 'internal' ? 'Maktab Internal Test' : '');
  if (!publisher) throw new Error('MAKTAB_AUTHENTICODE_PUBLISHER is required for production');
  const allowedOrigins = (process.env.MAKTAB_UPDATE_ALLOWED_ORIGINS || [
    'https://github.com',
    'https://objects.githubusercontent.com',
    'https://release-assets.githubusercontent.com',
  ].join(',')).split(',').map((value) => value.trim()).filter(Boolean);
  if (distribution === 'production') {
    const mode = process.env.MAKTAB_SIGNING_MODE;
    const pfx = mode === 'pfx' && process.env.CSC_LINK && process.env.CSC_KEY_PASSWORD;
    const azure = mode === 'azure'
      && process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_ID
      && process.env.AZURE_CLIENT_SECRET && process.env.MAKTAB_AZURE_SIGNING_ENDPOINT
      && process.env.MAKTAB_AZURE_CERTIFICATE_PROFILE
      && process.env.MAKTAB_AZURE_CODE_SIGNING_ACCOUNT;
    if (!pfx && !azure) throw new Error('Production signing credentials are incomplete; unsigned fallback is forbidden');
  }

  const shortSha = commitSha.slice(0, 12);
  const buildId = distribution === 'production'
    ? `${version}-${channel}-${shortSha}`
    : `${version}-${channel}-internal-${shortSha}`;
  const config = parseReleaseConfig({
    schemaVersion: 1,
    distribution,
    version,
    buildId,
    commitSha,
    channel,
    platform: 'win32',
    arch: 'x64',
    releaseApiUrl,
    updateFeed: {
      provider: 'github-release', owner: 'Ahmadullah-github', repository: 'maktab',
      allowedOrigins,
    },
    trust: {
      licenseKeyIds: license.ids,
      updateKeyIds: update.ids,
      authenticodePublishers: [publisher],
    },
  }, { appVersion: version, platform: 'win32', arch: 'x64' });

  if (write) {
    fs.mkdirSync(desktopStaging, { recursive: true });
    fs.writeFileSync(path.join(desktopStaging, 'release-config.json'), `${JSON.stringify(config, null, 2)}\n`);
    fs.writeFileSync(path.join(desktopStaging, 'license-public-keys.json'), `${JSON.stringify(license.ring, null, 2)}\n`);
    fs.writeFileSync(path.join(desktopStaging, 'update-public-keys.json'), `${JSON.stringify(update.ring, null, 2)}\n`);
    if (distribution === 'internal' && (license.privateKey || update.privateKey)) {
      fs.writeFileSync(path.join(stagingRoot, 'internal-signing-keys.json'), JSON.stringify({
        license: license.privateKey ? { keyId: license.ids[0], privateKey: license.privateKey } : null,
        update: update.privateKey ? { keyId: update.ids[0], privateKey: update.privateKey } : null,
      }), { mode: 0o600 });
    }
  }
  return { config, stagingRoot, desktopStaging };
}

module.exports = { buildReleaseInputs, desktopStaging, projectRoot, stagingRoot };
