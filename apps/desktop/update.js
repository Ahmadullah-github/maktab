const crypto = require('crypto');
const path = require('path');
const { autoUpdater, CancellationToken } = require('electron-updater');
const { normalizeServiceUrl } = require('./security');
const { compareVersions } = require('./update-contract');
const { loadKeyRing } = require('./trusted-keys');

function canonicalManifest(manifest) {
  const unsigned = { ...manifest };
  delete unsigned.signature;
  const stable = (value) => {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
    return JSON.stringify(value);
  };
  return Buffer.from(stable(unsigned));
}

class UpdateManager {
  constructor({ app, runtimeInfo, createPreUpdateBackup }) {
    this.app = app; this.runtime = runtimeInfo; this.createPreUpdateBackup = createPreUpdateBackup;
    this.baseUrl = normalizeServiceUrl(process.env.MAKTAB_RELEASE_API_URL, { requireHttps: app.isPackaged });
    this.feedUrl = normalizeServiceUrl(process.env.MAKTAB_UPDATE_FEED_URL, { requireHttps: app.isPackaged });
    const resourceRing = app.isPackaged ? path.join(__dirname, 'update-public-keys.json') : '';
    this.trustedKeys = loadKeyRing({
      purpose: 'Update',
      environmentValue: process.env.MAKTAB_UPDATE_PUBLIC_KEYS,
      resourcePath: resourceRing,
      legacyKey: process.env.MAKTAB_UPDATE_PUBLIC_KEY,
      legacyKeyId: process.env.MAKTAB_UPDATE_KEY_ID,
    });
    this.status = { state: 'idle', channel: runtimeInfo.channel, available: null };
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.on('download-progress', (progress) => { this.status = { ...this.status, state: 'downloading', percent: progress.percent }; });
    autoUpdater.on('update-downloaded', () => { this.status = { ...this.status, state: 'downloaded' }; });
    autoUpdater.on('error', (error) => { this.status = { ...this.status, state: 'error', message: error.message }; });
  }

  getStatus() { return this.status; }

  verify(manifest) {
    const publicKey = this.trustedKeys[manifest.key_id];
    if (!publicKey || !manifest.signature) throw new Error('Update verification key or signature is unavailable');
    if (manifest.schema_version !== 1 || manifest.channel !== this.runtime.channel) throw new Error('Update channel or schema is incompatible');
    const signature = Buffer.from(manifest.signature, 'base64url');
    if (!crypto.verify(null, canonicalManifest(manifest), publicKey, signature)) throw new Error('Update manifest signature is invalid');
    if (compareVersions(manifest.version, this.runtime.appVersion) <= 0) return null;
    if (compareVersions(this.runtime.appVersion, manifest.minimum_supported_version) < 0) throw new Error('A manual upgrade is required for this version');
    const artifact = manifest.artifacts?.[0];
    let artifactUrl;
    try { artifactUrl = new URL(artifact?.url); } catch { artifactUrl = null; }
    if (
      !artifact ||
      !artifactUrl ||
      artifactUrl.protocol !== 'https:' ||
      artifactUrl.username ||
      artifactUrl.password ||
      !/^[A-Za-z0-9+/=]{80,}$/.test(artifact.sha512)
    ) throw new Error('Update artifact contract is invalid');
    return manifest;
  }

  async check() {
    if (!this.app.isPackaged) return this.status;
    if (!this.baseUrl || !this.feedUrl) throw new Error('Update service is not configured');
    this.status = { ...this.status, state: 'checking' };
    const response = await fetch(`${this.baseUrl}/v1/updates/windows/x64/${this.runtime.channel}/latest`);
    const payload = await response.json().catch(() => ({}));
    if (response.status === 404) return (this.status = { state: 'idle', channel: this.runtime.channel, available: null });
    if (!response.ok) throw new Error(`Update check failed (${response.status})`);
    const manifest = this.verify(payload);
    if (!manifest) return (this.status = { state: 'idle', channel: this.runtime.channel, available: null });
    autoUpdater.setFeedURL({ provider: 'generic', url: `${this.feedUrl}/${this.runtime.channel}/windows-x64` });
    const result = await autoUpdater.checkForUpdates();
    if (!result?.updateInfo || result.updateInfo.version !== manifest.version) throw new Error('Updater metadata does not match the signed manifest');
    this.status = { state: 'available', channel: this.runtime.channel, available: { version: manifest.version, buildId: manifest.build_id, releaseNotes: manifest.release_notes } };
    return this.status;
  }

  async download() {
    if (this.status.state !== 'available') throw new Error('No verified update is available');
    this.cancellationToken = new CancellationToken();
    await autoUpdater.downloadUpdate(this.cancellationToken);
    return this.status;
  }

  cancel() {
    if (this.cancellationToken) this.cancellationToken.cancel();
    this.cancellationToken = null;
    this.status = { ...this.status, state: 'available', percent: undefined };
    return this.status;
  }

  async install() {
    if (this.status.state !== 'downloaded') throw new Error('The verified update has not been downloaded');
    await this.createPreUpdateBackup();
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
    return { installing: true };
  }
}

module.exports = { UpdateManager };
