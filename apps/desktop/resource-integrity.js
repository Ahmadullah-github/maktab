const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const HASH_PATTERN = /^[a-f0-9]{64}$/;

async function sha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const input = fs.createReadStream(filePath);
    input.once('error', reject);
    input.on('data', (chunk) => hash.update(chunk));
    input.once('end', () => resolve(hash.digest('hex')));
  });
}

function loadManifest(manifestPath = path.join(__dirname, 'component-integrity.json')) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.schemaVersion !== 1 || !manifest.components || typeof manifest.components !== 'object') {
    throw new Error('Packaged component integrity manifest is invalid');
  }
  return manifest;
}

function resolveComponent(resourcesPath, component) {
  if (
    !component ||
    typeof component.relativePath !== 'string' ||
    path.isAbsolute(component.relativePath) ||
    typeof component.sha256 !== 'string' ||
    !HASH_PATTERN.test(component.sha256)
  ) {
    throw new Error('Packaged component integrity entry is invalid');
  }
  const resolved = path.resolve(resourcesPath, component.relativePath);
  const relative = path.relative(path.resolve(resourcesPath), resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Packaged component integrity path escapes the resources directory');
  }
  return resolved;
}

async function verifyPackagedComponents({ resourcesPath, platform, manifestPath }) {
  const manifest = loadManifest(manifestPath);
  if (manifest.platform !== platform) throw new Error('Packaged component platform does not match the runtime');

  const expectedNames = ['betterSqlite3', 'solver'];
  if (Object.keys(manifest.components).sort().join(',') !== expectedNames.sort().join(',')) {
    throw new Error('Packaged component integrity manifest has unexpected entries');
  }

  for (const name of expectedNames) {
    const component = manifest.components[name];
    const filePath = resolveComponent(resourcesPath, component);
    if (!fs.existsSync(filePath)) throw new Error(`Required packaged component is missing: ${name}`);
    const actual = await sha256(filePath);
    if (!crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(component.sha256))) {
      throw new Error(
        `Packaged component failed integrity verification: ${name} `
        + `(expected ${component.sha256}, actual ${actual})`
      );
    }
  }
  return true;
}

module.exports = { loadManifest, resolveComponent, sha256, verifyPackagedComponents };
