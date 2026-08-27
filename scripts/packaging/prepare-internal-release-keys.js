const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const releaseKeys = path.join(projectRoot, 'release-keys');
const privateDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-internal-release-keys-'));
fs.mkdirSync(releaseKeys, { recursive: true });

function generate(purpose) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const keyId = `${purpose}-internal-${crypto.randomBytes(6).toString('hex')}`;
  const ring = {
    schema_version: 1,
    keys: [{ key_id: keyId, public_key: publicKey.export({ type: 'spki', format: 'pem' }) }],
  };
  fs.writeFileSync(path.join(releaseKeys, `${purpose}-public-keys.json`), `${JSON.stringify(ring, null, 2)}\n`);
  const privatePath = path.join(privateDirectory, `${purpose}-private.pem`);
  fs.writeFileSync(privatePath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  return { keyId, privatePath };
}

const license = generate('license'); const update = generate('update');
if (process.env.GITHUB_ENV) {
  fs.appendFileSync(process.env.GITHUB_ENV, [
    `MAKTAB_INTERNAL_LICENSE_KEY_ID=${license.keyId}`,
    `MAKTAB_INTERNAL_LICENSE_PRIVATE_KEY=${license.privatePath}`,
    `MAKTAB_INTERNAL_UPDATE_KEY_ID=${update.keyId}`,
    `MAKTAB_INTERNAL_UPDATE_PRIVATE_KEY=${update.privatePath}`,
  ].join(os.EOL) + os.EOL);
}
console.log(JSON.stringify({ license, update, privateDirectory }, null, 2));
