const crypto = require('node:crypto');

function failure(status, code, message) {
  return { status, body: { error: { code, message, retryable: false } } };
}

class InternalLicenseAuthority {
  constructor({ keyId, privateKey, qaLicenseKey, channel }) {
    if (!/^license-[a-z0-9-]+$/.test(keyId) || !qaLicenseKey || !['pilot', 'stable'].includes(channel)) {
      throw new Error('Internal license authority configuration is invalid');
    }
    this.keyId = keyId;
    this.privateKey = privateKey;
    this.qaLicenseKey = qaLicenseKey;
    this.channel = channel;
    this.activation = null;
  }

  issueLease() {
    const now = Math.floor(Date.now() / 1000);
    const leaseId = crypto.randomUUID();
    const header = { alg: 'EdDSA', typ: 'JWT', kid: this.keyId };
    const claims = {
      ver: 1, jti: leaseId, iss: 'maktab-release', aud: 'maktab-desktop',
      product: 'desktop-timetable', activation_id: this.activation.id,
      license_id: 'internal-qa', device_id: this.activation.deviceId,
      entitlements: ['timetable.generate'], channel: this.channel,
      iat: now, nbf: now - 60, exp: now + 30 * 86_400,
      grace_until: now + 44 * 86_400, key_id: this.keyId,
    };
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const payload = `${encode(header)}.${encode(claims)}`;
    const signature = crypto.sign(null, Buffer.from(payload), this.privateKey).toString('base64url');
    this.activation.leaseId = leaseId;
    return `${payload}.${signature}`;
  }

  response() {
    return {
      status: 200,
      body: {
        activation_id: this.activation.id,
        refresh_token: this.activation.refreshToken,
        lease: this.issueLease(),
        server_time: new Date().toISOString(),
      },
    };
  }

  activate(body) {
    if (
      body?.license_key !== this.qaLicenseKey || body?.product !== 'desktop-timetable'
      || typeof body?.device?.id !== 'string' || body.device.id.length < 16
      || body?.device?.platform !== 'win32' || body?.device?.arch !== 'x64'
      || body?.app?.channel !== this.channel
    ) return failure(403, 'INVALID_LICENSE_KEY', 'License key is invalid.');
    if (this.activation?.active && this.activation.deviceId !== body.device.id) {
      return failure(409, 'DEVICE_LIMIT', 'The QA license is already active.');
    }
    this.activation = {
      id: this.activation?.id || crypto.randomUUID(), deviceId: body.device.id,
      refreshToken: crypto.randomBytes(48).toString('base64url'), active: true, leaseId: null,
    };
    return this.response();
  }

  refresh(body) {
    if (
      !this.activation?.active || body?.activation_id !== this.activation.id
      || body?.device_id !== this.activation.deviceId
      || body?.refresh_token !== this.activation.refreshToken
      || body?.current_lease_id !== this.activation.leaseId
    ) return failure(403, 'INVALID_REFRESH', 'Refresh credential is invalid.');
    this.activation.refreshToken = crypto.randomBytes(48).toString('base64url');
    return this.response();
  }

  deactivate(body) {
    if (
      !this.activation || body?.activation_id !== this.activation.id
      || body?.device_id !== this.activation.deviceId
      || body?.refresh_token !== this.activation.refreshToken
    ) return failure(403, 'INVALID_REFRESH', 'Refresh credential is invalid.');
    this.activation.active = false;
    return { status: 200, body: { status: 'deactivated' } };
  }

  handle(pathname, body) {
    if (pathname === '/v1/activations') return this.activate(body);
    if (pathname === '/v1/activations/refresh') return this.refresh(body);
    if (pathname === '/v1/activations/deactivate') return this.deactivate(body);
    return failure(404, 'NOT_FOUND', 'Not found.');
  }
}

module.exports = { InternalLicenseAuthority };
