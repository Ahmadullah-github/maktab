const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const { shouldInvalidateLease, verifyLeaseEnvelope } = require('../license-contract');
const { parseKeyRing } = require('../trusted-keys');

function b64(value) { return Buffer.from(value).toString('base64url'); }

function publicPem(key) {
  return key.export({ type: 'spki', format: 'pem' });
}

function lease(privateKey, keyId, overrides = {}) {
  const now = 2_000_000_000;
  const header = b64(JSON.stringify({ alg: 'EdDSA', typ: 'JWT', kid: keyId }));
  const claims = b64(JSON.stringify({
    ver: 1, jti: crypto.randomUUID(), iss: 'maktab-release', aud: 'maktab-desktop',
    product: 'desktop-timetable', activation_id: '1', license_id: '1',
    device_id: 'device-one', entitlements: ['timetable.generate'], channel: 'stable',
    iat: now, nbf: now - 60, exp: now + 30 * 86400, grace_until: now + 37 * 86400,
    key_id: keyId, ...overrides,
  }));
  const payload = `${header}.${claims}`;
  return `${payload}.${crypto.sign(null, Buffer.from(payload), privateKey).toString('base64url')}`;
}

test('lease verification accepts overlapping keys and rejects unknown or tampered leases', () => {
  const oldKey = crypto.generateKeyPairSync('ed25519');
  const currentKey = crypto.generateKeyPairSync('ed25519');
  const trustedKeys = parseKeyRing({
    schema_version: 1,
    keys: [
      { key_id: 'license-old', public_key: publicPem(oldKey.publicKey) },
      { key_id: 'license-current', public_key: publicPem(currentKey.publicKey) },
    ],
  }, 'License');
  const options = { trustedKeys, deviceId: 'device-one', nowMs: 2_000_000_000_000 };
  assert.equal(verifyLeaseEnvelope(lease(oldKey.privateKey, 'license-old'), options).state, 'active');
  assert.equal(verifyLeaseEnvelope(lease(currentKey.privateKey, 'license-current'), options).state, 'active');

  const unknown = crypto.generateKeyPairSync('ed25519');
  assert.throws(() => verifyLeaseEnvelope(lease(unknown.privateKey, 'license-unknown'), options), /not trusted/);
  const compact = lease(currentKey.privateKey, 'license-current');
  const [header, claims, signature] = compact.split('.');
  const tampered = `${header}.${b64(JSON.stringify({ ...JSON.parse(Buffer.from(claims, 'base64url')), device_id: 'attacker' }))}.${signature}`;
  assert.throws(() => verifyLeaseEnvelope(tampered, options), /signature/);
});

test('lease verification covers device, expiry, grace, and clock rollback states', () => {
  const keys = crypto.generateKeyPairSync('ed25519');
  const trustedKeys = { 'license-current': publicPem(keys.publicKey) };
  const base = { trustedKeys, deviceId: 'device-one', nowMs: 2_000_000_000_000 };
  assert.equal(verifyLeaseEnvelope(lease(keys.privateKey, 'license-current'), { ...base, deviceId: 'device-two' }).state, 'device_mismatch');
  assert.equal(verifyLeaseEnvelope(lease(keys.privateKey, 'license-current', { exp: 1_999_999_900, grace_until: 2_000_000_100 }), base).state, 'grace');
  assert.equal(verifyLeaseEnvelope(lease(keys.privateKey, 'license-current', { exp: 1_999_999_800, grace_until: 1_999_999_900 }), base).state, 'expired');
  assert.equal(verifyLeaseEnvelope(lease(keys.privateKey, 'license-current'), { ...base, trustedTimeMs: base.nowMs + 600_000 }).state, 'clock_suspect');
});

test('only authoritative lifecycle failures invalidate an offline lease', () => {
  for (const code of ['LICENSE_REVOKED', 'LICENSE_DISABLED', 'LICENSE_EXPIRED']) assert.equal(shouldInvalidateLease(code), true);
  for (const code of ['NETWORK_UNAVAILABLE', 'RATE_LIMITED', 'LICENSE_SERVICE_FAILED']) assert.equal(shouldInvalidateLease(code), false);
});
