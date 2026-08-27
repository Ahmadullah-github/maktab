const path = require('node:path');

function pathParts(value) {
  if (typeof value !== 'string' || value.includes('\0')) {
    throw new TypeError('ASAR path must be a string without NUL bytes');
  }
  const parts = value.split(/[\\/]+/).filter(Boolean);
  if (parts.some((part) => part === '.' || part === '..')) {
    throw new Error(`Unsafe ASAR path: ${value}`);
  }
  return parts;
}

function toHostAsarPath(value, separator = path.sep) {
  return pathParts(value).join(separator);
}

function normalizeAsarEntry(value) {
  return pathParts(value).join('/');
}

module.exports = { normalizeAsarEntry, toHostAsarPath };
