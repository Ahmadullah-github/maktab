const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const { InternalLicenseAuthority } = require('../../../scripts/packaging/internal-license-authority');
const { verifyLeaseEnvelope } = require('../license-contract');

function fixture() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const keyId = 'license-internal-contract';
  const authority = new InternalLicenseAuthority({
    keyId,
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    qaLicenseKey: 'MKT-QA-1234567890-acceptance',
    channel: 'pilot',
  });
  return { authority, keyId, publicKey };
}

function activationRequest(deviceId = 'device-identifier-0000000000000001') {
  return {
    license_key: 'MKT-QA-1234567890-acceptance', product: 'desktop-timetable',
    device: { id: deviceId, platform: 'win32', arch: 'x64' },
    app: { channel: 'pilot' },
  };
}

test('internal acceptance authority issues a device-bound verifiable lease', () => {
  const { authority, keyId, publicKey } = fixture();
  const response = authority.activate(activationRequest());
  assert.equal(response.status, 200);
  const verified = verifyLeaseEnvelope(response.body.lease, {
    trustedKeys: { [keyId]: publicKey },
    deviceId: activationRequest().device.id,
  });
  assert.equal(verified.state, 'active');
  assert.equal(verified.claims.activation_id, response.body.activation_id);
  assert.equal(authority.activate(activationRequest('other-device-000000000000000001')).status, 409);
});

test('internal acceptance refresh rotates credentials and deactivation closes the lease', () => {
  const { authority } = fixture();
  const activated = authority.activate(activationRequest()).body;
  const claims = JSON.parse(Buffer.from(activated.lease.split('.')[1], 'base64url').toString('utf8'));
  const refreshed = authority.refresh({
    activation_id: activated.activation_id,
    device_id: activationRequest().device.id,
    refresh_token: activated.refresh_token,
    current_lease_id: claims.jti,
  });
  assert.equal(refreshed.status, 200);
  assert.notEqual(refreshed.body.refresh_token, activated.refresh_token);
  assert.equal(authority.refresh({
    activation_id: activated.activation_id,
    device_id: activationRequest().device.id,
    refresh_token: activated.refresh_token,
    current_lease_id: claims.jti,
  }).status, 403);
  assert.equal(authority.deactivate({
    activation_id: activated.activation_id,
    device_id: activationRequest().device.id,
    refresh_token: refreshed.body.refresh_token,
  }).status, 200);
});
