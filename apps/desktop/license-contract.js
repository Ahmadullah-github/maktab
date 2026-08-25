const crypto = require('crypto');

function decodeJson(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function unavailable(state, message, claims = null) {
  return { state, canGenerate: false, message, claims };
}

function verifyLeaseEnvelope(compact, { trustedKeys, deviceId, trustedTimeMs = 0, nowMs = Date.now() }) {
  if (typeof compact !== 'string' || compact.length > 16_384) throw new Error('License lease envelope is invalid');
  const parts = compact.trim().split('.');
  if (parts.length !== 3) throw new Error('License lease envelope is invalid');
  const header = decodeJson(parts[0]);
  const claims = decodeJson(parts[1]);
  if (!header || header.alg !== 'EdDSA' || header.typ !== 'JWT' || typeof header.kid !== 'string') throw new Error('License lease header is invalid');
  const publicKey = trustedKeys[header.kid];
  if (!publicKey) throw new Error('License lease signing key is not trusted');
  if (!crypto.verify(null, Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, Buffer.from(parts[2], 'base64url'))) throw new Error('License lease signature is invalid');
  if (
    !claims || claims.ver !== 1 || claims.iss !== 'maktab-release' || claims.aud !== 'maktab-desktop'
    || claims.product !== 'desktop-timetable' || claims.key_id !== header.kid
    || typeof claims.jti !== 'string' || typeof claims.activation_id !== 'string'
    || typeof claims.device_id !== 'string' || !Number.isInteger(claims.nbf)
    || !Number.isInteger(claims.exp) || !Number.isInteger(claims.grace_until)
    || claims.grace_until < claims.exp
  ) throw new Error('License lease claims are invalid');
  if (claims.device_id !== deviceId) return unavailable('device_mismatch', 'This activation belongs to another device.', claims);
  if (!Array.isArray(claims.entitlements) || !claims.entitlements.includes('timetable.generate')) return unavailable('expired', 'Timetable generation is not entitled.', claims);
  if (trustedTimeMs > 0 && nowMs + 300_000 < trustedTimeMs) return unavailable('clock_suspect', 'System clock verification is required.', claims);
  const now = Math.floor(nowMs / 1000);
  if (now < claims.nbf) return unavailable('clock_suspect', 'The license is not valid at the current system time.', claims);
  const state = now <= claims.exp ? (claims.exp - now <= 604_800 ? 'renewal_due' : 'active') : now <= claims.grace_until ? 'grace' : 'expired';
  return {
    state,
    canGenerate: ['active', 'renewal_due', 'grace'].includes(state),
    message: state === 'expired' ? 'The license has expired; existing timetable data remains available.' : 'License verified.',
    claims,
  };
}

function shouldInvalidateLease(errorCode) {
  return ['LICENSE_REVOKED', 'LICENSE_DISABLED', 'LICENSE_EXPIRED'].includes(errorCode);
}

module.exports = { shouldInvalidateLease, verifyLeaseEnvelope };
