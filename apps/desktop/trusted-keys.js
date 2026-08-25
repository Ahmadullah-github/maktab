const fs = require('fs');

function parseKeyRing(value, purpose) {
  if (!value) return Object.freeze({});
  let parsed;
  try { parsed = typeof value === 'string' ? JSON.parse(value) : value; } catch { throw new Error(`${purpose} public key ring is invalid`); }
  const entries = parsed?.schema_version === 1 && Array.isArray(parsed.keys)
    ? parsed.keys.map((entry) => [entry.key_id, entry.public_key])
    : Object.entries(parsed || {});
  if (!entries.length) throw new Error(`${purpose} public key ring is empty`);
  const result = {};
  for (const [keyId, publicKey] of entries) {
    if (typeof keyId !== 'string' || !/^[A-Za-z0-9._-]{3,64}$/.test(keyId) || typeof publicKey !== 'string' || !publicKey.includes('PUBLIC KEY')) {
      throw new Error(`${purpose} public key ring contains an invalid entry`);
    }
    result[keyId] = publicKey.replace(/\\n/g, '\n');
  }
  return Object.freeze(result);
}

function loadKeyRing({ purpose, environmentValue, resourcePath, legacyKey, legacyKeyId }) {
  if (environmentValue) return parseKeyRing(environmentValue, purpose);
  if (resourcePath && fs.existsSync(resourcePath)) return parseKeyRing(fs.readFileSync(resourcePath, 'utf8'), purpose);
  if (legacyKey && legacyKeyId) return Object.freeze({ [legacyKeyId]: legacyKey.replace(/\\n/g, '\n') });
  return Object.freeze({});
}

module.exports = { loadKeyRing, parseKeyRing };
