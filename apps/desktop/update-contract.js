const crypto = require('node:crypto');
const path = require('node:path');

const MANIFEST_KEYS = Object.freeze([
  'schema_version', 'channel', 'version', 'build_id', 'published_at',
  'minimum_supported_version', 'rollout_percent', 'release_notes',
  'updater_metadata', 'artifacts', 'key_id', 'signature',
]);

function compareVersions(left, right) {
  const parse = (value) => value.split(/[.-]/).map((part) => /^\d+$/.test(part) ? Number(part) : part);
  const a = parse(left); const b = parse(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const x = a[index] ?? 0; const y = b[index] ?? 0;
    if (x === y) continue;
    if (typeof x === typeof y) return x > y ? 1 : -1;
    return typeof x === 'number' ? 1 : -1;
  }
  return 0;
}

function exactObject(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function canonicalManifest(manifest) {
  const unsigned = { ...manifest }; delete unsigned.signature;
  const stable = (value) => {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  };
  return Buffer.from(stable(unsigned));
}

function strictHttpsUrl(value, allowedOrigins) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('Update URL is invalid'); }
  if (
    parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash
    || !allowedOrigins.includes(parsed.origin)
  ) throw new Error('Update URL is not trusted');
  return parsed;
}

function parseSignedManifest(manifest, { channel, allowedOrigins, acceptedPublishers, acceptedKeyIds }) {
  if (!exactObject(manifest, MANIFEST_KEYS)) throw new Error('Update manifest has an invalid shape');
  if (manifest.schema_version !== 2 || manifest.channel !== channel) throw new Error('Update channel or schema is incompatible');
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version)) throw new Error('Update version is invalid');
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.minimum_supported_version)) throw new Error('Minimum supported version is invalid');
  if (!/^[0-9A-Za-z.-]{8,128}$/.test(manifest.build_id)) throw new Error('Update build ID is invalid');
  if (!Number.isInteger(manifest.rollout_percent) || manifest.rollout_percent < 0 || manifest.rollout_percent > 100) throw new Error('Update rollout is invalid');
  if (typeof manifest.published_at !== 'string' || !Number.isFinite(Date.parse(manifest.published_at))) throw new Error('Update publication time is invalid');
  if (typeof manifest.release_notes !== 'string' || Buffer.byteLength(manifest.release_notes) > 16_384) throw new Error('Update release notes are invalid');
  if (!acceptedKeyIds.includes(manifest.key_id) || typeof manifest.signature !== 'string' || !/^[A-Za-z0-9_-]{64,256}$/.test(manifest.signature)) {
    throw new Error('Update signing identity is not trusted');
  }
  if (!exactObject(manifest.updater_metadata, ['url', 'sha256']) || !/^[a-f0-9]{64}$/.test(manifest.updater_metadata.sha256)) {
    throw new Error('Updater metadata contract is invalid');
  }
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length !== 1) throw new Error('Update artifact contract is invalid');
  const artifact = manifest.artifacts[0];
  if (!exactObject(artifact, ['filename', 'url', 'size', 'sha256', 'sha512', 'authenticode_publisher'])) {
    throw new Error('Update artifact contract is invalid');
  }
  if (
    typeof artifact.filename !== 'string' || artifact.filename !== path.win32.basename(artifact.filename)
    || !/^Maktab-Timetable-[0-9A-Za-z.-]+-x64\.exe$/.test(artifact.filename)
    || !Number.isSafeInteger(artifact.size) || artifact.size < 1 || artifact.size > 2 * 1024 * 1024 * 1024
    || !/^[a-f0-9]{64}$/.test(artifact.sha256)
    || !/^[A-Za-z0-9+/]{86}==$/.test(artifact.sha512)
    || !acceptedPublishers.includes(artifact.authenticode_publisher)
  ) throw new Error('Update artifact identity is invalid');
  const metadataUrl = strictHttpsUrl(manifest.updater_metadata.url, allowedOrigins);
  const artifactUrl = strictHttpsUrl(artifact.url, allowedOrigins);
  if (decodeURIComponent(artifactUrl.pathname.split('/').pop()) !== artifact.filename) throw new Error('Update artifact filename does not match its URL');
  if (new URL('.', metadataUrl).href !== new URL('.', artifactUrl).href) throw new Error('Updater metadata and artifact must share an immutable release directory');
  return Object.freeze({ ...manifest, updater_metadata: { ...manifest.updater_metadata }, artifacts: [{ ...artifact }] });
}

function rolloutBucket(deviceId, channel) {
  if (typeof deviceId !== 'string' || deviceId.length < 16 || !['pilot', 'stable'].includes(channel)) throw new Error('Rollout identity is invalid');
  const digest = crypto.createHash('sha256').update(`maktab-update-rollout-v1\0${deviceId}\0${channel}`).digest();
  return digest.readUInt32BE(0) % 10_000;
}

function isRolloutEligible(deviceId, channel, percent) {
  if (percent === 0) return false;
  if (percent === 100) return true;
  return rolloutBucket(deviceId, channel) < percent * 100;
}

function validateUpdaterInfo(updateInfo, manifest) {
  if (!updateInfo || updateInfo.version !== manifest.version || !Array.isArray(updateInfo.files)) {
    throw new Error('Updater metadata does not match the signed manifest');
  }
  const artifact = manifest.artifacts[0];
  const file = updateInfo.files.find((candidate) => {
    try { return decodeURIComponent(new URL(candidate.url, 'https://local.invalid/').pathname.split('/').pop()) === artifact.filename; }
    catch { return false; }
  });
  if (!file || file.sha512 !== artifact.sha512 || Number(file.size) !== artifact.size) {
    throw new Error('Updater artifact metadata does not match the signed manifest');
  }
  return true;
}

module.exports = {
  canonicalManifest, compareVersions, isRolloutEligible, parseSignedManifest,
  rolloutBucket, validateUpdaterInfo,
};
