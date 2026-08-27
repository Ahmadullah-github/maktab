const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { safeStorage } = require('electron');
const { getLicenseDevice } = require('./machineId');
const { normalizeServiceUrl } = require('./security');
const { shouldInvalidateLease, verifyLeaseEnvelope } = require('./license-contract');
const { loadKeyRing } = require('./trusted-keys');

class ReleaseServiceError extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.name = 'ReleaseServiceError';
    this.code = code;
    this.retryable = retryable;
  }
}

class LicenseManager {
  constructor(app, runtimeInfo, releaseConfig, fetchImpl = globalThis.fetch) {
    this.app = app;
    this.runtime = runtimeInfo;
    this.fetch = fetchImpl;
    this.directory = path.join(app.getPath('userData'), 'license');
    this.leasePath = path.join(this.directory, 'lease.jws');
    this.statePath = path.join(this.directory, 'state.json');
    this.baseUrl = normalizeServiceUrl(
      app.isPackaged ? releaseConfig.releaseApiUrl : process.env.MAKTAB_RELEASE_API_URL,
      { requireHttps: app.isPackaged }
    );
    const resourceRing = app.isPackaged ? path.join(__dirname, 'license-public-keys.json') : '';
    this.trustedKeys = loadKeyRing({
      purpose: 'License',
      environmentValue: process.env.MAKTAB_LICENSE_PUBLIC_KEYS,
      resourcePath: resourceRing,
      legacyKey: process.env.MAKTAB_LICENSE_PUBLIC_KEY,
      legacyKeyId: process.env.MAKTAB_LICENSE_KEY_ID,
    });
    if (app.isPackaged) {
      const embeddedIds = Object.keys(this.trustedKeys).sort();
      const configuredIds = [...releaseConfig.trust.licenseKeyIds].sort();
      if (JSON.stringify(embeddedIds) !== JSON.stringify(configuredIds)) {
        throw new Error('Embedded license key ring does not match the release configuration');
      }
    }
  }

  async initialize() {
    await fs.promises.mkdir(this.directory, { recursive: true, mode: 0o700 });
    this.device = await getLicenseDevice();
  }

  readState() {
    try { return JSON.parse(fs.readFileSync(this.statePath, 'utf8')); } catch { return {}; }
  }

  async atomicWrite(target, data, mode = 0o600) {
    const temporary = `${target}.${crypto.randomUUID()}.tmp`;
    await fs.promises.writeFile(temporary, data, { mode });
    await fs.promises.rename(temporary, target);
  }

  verifyLease(compact, nowMs = Date.now()) {
    const state = this.readState();
    return verifyLeaseEnvelope(compact, {
      trustedKeys: this.trustedKeys,
      deviceId: this.device.id,
      trustedTimeMs: state.trustedTimeMs || 0,
      nowMs,
    });
  }

  publicStatus() {
    if (!this.app.isPackaged) return { state: 'active', canGenerate: true, isReadOnly: false, expiresAt: null, graceUntil: null, keyId: 'development', activationId: 'development', message: 'Development license enforcement is disabled.' };
    const state = this.readState();
    if (['revoked', 'disabled', 'expired'].includes(state.authorityState)) {
      const messages = {
        revoked: 'This license was revoked; local timetable data remains available.',
        disabled: 'This license was disabled; local timetable data remains available.',
        expired: 'This license expired; local timetable data remains available.',
      };
      return { state: state.authorityState, canGenerate: false, isReadOnly: false, expiresAt: null, graceUntil: null, keyId: null, activationId: state.activationId || null, message: messages[state.authorityState] };
    }
    if (!fs.existsSync(this.leasePath)) return { state: 'unactivated', canGenerate: false, isReadOnly: false, expiresAt: null, graceUntil: null, keyId: null, activationId: null, message: 'Activation is required to generate a timetable.' };
    try {
      const verified = this.verifyLease(fs.readFileSync(this.leasePath, 'utf8'));
      return {
        state: verified.state, canGenerate: verified.canGenerate, isReadOnly: false,
        expiresAt: new Date(verified.claims.exp * 1000).toISOString(),
        graceUntil: new Date(verified.claims.grace_until * 1000).toISOString(),
        keyId: verified.claims.key_id, activationId: verified.claims.activation_id,
        message: verified.message,
      };
    } catch (error) {
      return { state: 'service_unavailable', canGenerate: false, isReadOnly: false, expiresAt: null, graceUntil: null, keyId: null, activationId: null, message: error.message };
    }
  }

  async request(endpoint, body) {
    if (!this.baseUrl) throw new Error('License service is not configured');
    let response;
    try {
      response = await this.fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ReleaseServiceError('LICENSE_SERVICE_UNAVAILABLE', 'The license service is temporarily unavailable', true);
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new ReleaseServiceError(payload?.error?.code || 'LICENSE_SERVICE_FAILED', payload?.error?.message || `License service request failed (${response.status})`, payload?.error?.retryable === true || response.status >= 500);
    return payload;
  }

  async storeResponse(response) {
    const verified = this.verifyLease(response.lease);
    if (!verified.canGenerate) throw new Error('License service returned an unusable lease');
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows secure storage is unavailable');
    const prior = this.readState();
    const serverTimeMs = Date.parse(response.server_time);
    await this.atomicWrite(this.leasePath, response.lease);
    await this.atomicWrite(this.statePath, JSON.stringify({
      activationId: response.activation_id,
      encryptedRefreshToken: safeStorage.encryptString(response.refresh_token).toString('base64'),
      trustedTimeMs: Math.max(prior.trustedTimeMs || 0, Number.isFinite(serverTimeMs) ? serverTimeMs : 0, Date.now()),
      authorityState: null,
    }));
    return this.publicStatus();
  }

  async activate(licenseKey) {
    if (typeof licenseKey !== 'string' || licenseKey.length < 16 || licenseKey.length > 256) throw new Error('License key format is invalid');
    const response = await this.request('/v1/activations', {
      schema_version: 1, license_key: licenseKey, product: 'desktop-timetable',
      device: { id: this.device.id, support_code: this.device.supportCode, platform: process.platform, arch: process.arch },
      app: { version: this.runtime.appVersion, build_id: this.runtime.buildId, channel: this.runtime.channel },
      idempotency_key: crypto.randomUUID(),
    });
    return this.storeResponse(response);
  }

  decryptRefreshToken(state) {
    if (!state.encryptedRefreshToken || !safeStorage.isEncryptionAvailable()) throw new Error('Secure refresh credential is unavailable');
    return safeStorage.decryptString(Buffer.from(state.encryptedRefreshToken, 'base64'));
  }

  async refresh() {
    const state = this.readState();
    const status = this.publicStatus();
    try {
      const response = await this.request('/v1/activations/refresh', {
        schema_version: 1, activation_id: state.activationId, refresh_token: this.decryptRefreshToken(state),
        device_id: this.device.id, current_lease_id: this.verifyLease(fs.readFileSync(this.leasePath, 'utf8')).claims.jti,
        app_version: this.runtime.appVersion, build_id: this.runtime.buildId, idempotency_key: crypto.randomUUID(),
      });
      void status;
      return this.storeResponse(response);
    } catch (error) {
      if (error instanceof ReleaseServiceError && shouldInvalidateLease(error.code)) {
        const authorityState = error.code === 'LICENSE_REVOKED' ? 'revoked' : error.code === 'LICENSE_EXPIRED' ? 'expired' : 'disabled';
        await this.atomicWrite(this.statePath, JSON.stringify({ activationId: state.activationId, trustedTimeMs: Math.max(state.trustedTimeMs || 0, Date.now()), authorityState }));
        await fs.promises.rm(this.leasePath, { force: true });
        return this.publicStatus();
      }
      throw error;
    }
  }

  async deactivate() {
    const state = this.readState();
    if (state.activationId && state.encryptedRefreshToken) {
      await this.request('/v1/activations/deactivate', {
        schema_version: 1, activation_id: state.activationId,
        refresh_token: this.decryptRefreshToken(state), device_id: this.device.id,
        idempotency_key: crypto.randomUUID(),
      });
    }
    await Promise.all([fs.promises.rm(this.leasePath, { force: true }), fs.promises.rm(this.statePath, { force: true })]);
    return this.publicStatus();
  }

  childEnvironment() {
    const state = this.readState();
    return {
      MAKTAB_LICENSE_LEASE_PATH: this.leasePath,
      MAKTAB_LICENSE_PUBLIC_KEYS: JSON.stringify(this.trustedKeys),
      MAKTAB_LICENSE_DEVICE_ID: this.device.id,
      MAKTAB_TRUSTED_TIME_MS: String(state.trustedTimeMs || 0),
      LICENSE_ENFORCEMENT: '1',
    };
  }
}

module.exports = { LicenseManager, ReleaseServiceError };
