const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const sourceDirectory = path.join(projectRoot, 'release-keys');
const targetDirectory = path.join(projectRoot, 'apps', 'desktop');

function validateAndCopy(name, expectedPrefix) {
  const source = path.join(sourceDirectory, name);
  if (!fs.existsSync(source)) throw new Error(`Release public key ring is missing: ${source}`);
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(source, 'utf8')); } catch { throw new Error(`Release public key ring is invalid JSON: ${source}`); }
  if (parsed?.schema_version !== 1 || !Array.isArray(parsed.keys) || parsed.keys.length < 1) throw new Error(`Release public key ring has an invalid schema: ${source}`);
  const seen = new Set();
  for (const entry of parsed.keys) {
    if (!entry || typeof entry.key_id !== 'string' || !entry.key_id.startsWith(expectedPrefix) || seen.has(entry.key_id) || typeof entry.public_key !== 'string' || !entry.public_key.includes('PUBLIC KEY')) throw new Error(`Release public key ring contains an invalid entry: ${source}`);
    seen.add(entry.key_id);
  }
  fs.copyFileSync(source, path.join(targetDirectory, name));
}

exports.default = async function beforePack() {
  validateAndCopy('license-public-keys.json', 'license-');
  validateAndCopy('update-public-keys.json', 'update-');
};
