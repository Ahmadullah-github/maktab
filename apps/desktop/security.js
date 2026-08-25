const crypto = require('crypto');

const EXTERNAL_URL_ALLOWLIST = Object.freeze([]);

function parseUrl(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2_048) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function hasCredentials(url) {
  return url.username.length > 0 || url.password.length > 0;
}

function isAllowedRendererNavigation(candidate, rendererOrigin) {
  const target = parseUrl(candidate);
  const trusted = parseUrl(rendererOrigin);
  if (!target || !trusted || hasCredentials(target)) return false;
  if (!['http:', 'https:'].includes(trusted.protocol)) return false;
  return target.origin === trusted.origin;
}

function isAllowedExternalUrl(candidate, allowlist = EXTERNAL_URL_ALLOWLIST) {
  const target = parseUrl(candidate);
  if (!target || target.protocol !== 'https:' || hasCredentials(target)) return false;
  return allowlist.includes(target.origin);
}

function normalizeServiceUrl(value, { requireHttps = true } = {}) {
  if (value === undefined || value === null || value === '') return '';
  const parsed = parseUrl(value);
  if (
    !parsed ||
    hasCredentials(parsed) ||
    parsed.search ||
    parsed.hash ||
    (requireHttps && parsed.protocol !== 'https:') ||
    (!requireHttps && !['http:', 'https:'].includes(parsed.protocol))
  ) {
    throw new Error('Configured service URL is invalid');
  }
  return parsed.href.replace(/\/$/, '');
}

function verifySafeStorage(safeStorage) {
  if (!safeStorage || typeof safeStorage.isEncryptionAvailable !== 'function' || !safeStorage.isEncryptionAvailable()) {
    throw new Error('Windows secure storage is unavailable');
  }
  const sentinel = crypto.randomBytes(32).toString('base64url');
  const encrypted = safeStorage.encryptString(sentinel);
  if (!Buffer.isBuffer(encrypted) || encrypted.length === 0 || safeStorage.decryptString(encrypted) !== sentinel) {
    throw new Error('Windows secure storage self-test failed');
  }
  return Object.freeze({ safeStorage: 'ok' });
}

module.exports = {
  EXTERNAL_URL_ALLOWLIST,
  isAllowedExternalUrl,
  isAllowedRendererNavigation,
  normalizeServiceUrl,
  verifySafeStorage,
};
