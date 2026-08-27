const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const electronUpdater = require('electron-updater');
const { normalizeServiceUrl } = require('./security');
const {
  canonicalManifest, compareVersions, isRolloutEligible, parseSignedManifest, validateUpdaterInfo,
} = require('./update-contract');
const { loadKeyRing } = require('./trusted-keys');

const MAX_METADATA_BYTES = 256 * 1024;

async function hashFile(filePath, algorithm, encoding) {
  const hash = crypto.createHash(algorithm);
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk)); stream.once('end', resolve); stream.once('error', reject);
  });
  return hash.digest(encoding);
}

async function writeDurably(filePath, value) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${crypto.randomUUID()}.tmp`;
  const handle = await fs.promises.open(temporary, 'wx', 0o600);
  try { await handle.writeFile(value); await handle.sync(); } finally { await handle.close(); }
  await fs.promises.rename(temporary, filePath);
}

class UpdateManager {
  constructor({
    app, runtimeInfo, releaseConfig, deviceId, userDataPath, createPreUpdateBackup,
    getLicenseStatus = () => ({ state: 'unactivated', activationId: null }),
    fetchImpl = globalThis.fetch, updater,
  }) {
    this.app = app; this.runtime = runtimeInfo; this.releaseConfig = releaseConfig;
    this.deviceId = deviceId; this.createPreUpdateBackup = createPreUpdateBackup;
    this.getLicenseStatus = getLicenseStatus;
    this.fetch = fetchImpl;
    this.updater = updater || electronUpdater.autoUpdater;
    this.baseUrl = normalizeServiceUrl(
      app.isPackaged ? releaseConfig.releaseApiUrl : process.env.MAKTAB_RELEASE_API_URL,
      { requireHttps: app.isPackaged }
    );
    this.journalPath = path.join(userDataPath || app.getPath('userData'), 'updates', 'update-journal.json');
    const resourceRing = app.isPackaged ? path.join(__dirname, 'update-public-keys.json') : '';
    this.trustedKeys = loadKeyRing({
      purpose: 'Update', environmentValue: app.isPackaged ? '' : process.env.MAKTAB_UPDATE_PUBLIC_KEYS,
      resourcePath: resourceRing, legacyKey: app.isPackaged ? '' : process.env.MAKTAB_UPDATE_PUBLIC_KEY,
      legacyKeyId: app.isPackaged ? '' : process.env.MAKTAB_UPDATE_KEY_ID,
    });
    if (app.isPackaged) {
      const embeddedIds = Object.keys(this.trustedKeys).sort();
      const configuredIds = [...releaseConfig.trust.updateKeyIds].sort();
      if (JSON.stringify(embeddedIds) !== JSON.stringify(configuredIds)) {
        throw new Error('Embedded update key ring does not match the release configuration');
      }
    }
    this.status = { state: 'idle', channel: runtimeInfo.channel, available: null };
    this.updater.autoDownload = false; this.updater.autoInstallOnAppQuit = false;
    this.updater.on('download-progress', (progress) => { this.status = { ...this.status, state: 'downloading', percent: progress.percent }; });
    this.updater.on('error', (error) => { this.status = { ...this.status, state: 'error', message: error.message }; });
  }

  getStatus() { return this.status; }

  verify(manifest) {
    const parsed = parseSignedManifest(manifest, {
      channel: this.runtime.channel,
      allowedOrigins: this.releaseConfig.updateFeed.allowedOrigins,
      acceptedPublishers: this.releaseConfig.trust.authenticodePublishers,
      acceptedKeyIds: this.releaseConfig.trust.updateKeyIds,
    });
    const publicKey = this.trustedKeys[parsed.key_id];
    if (!publicKey || !crypto.verify(null, canonicalManifest(parsed), publicKey, Buffer.from(parsed.signature, 'base64url'))) {
      throw new Error('Update manifest signature is invalid');
    }
    if (compareVersions(parsed.version, this.runtime.appVersion) <= 0) return null;
    if (compareVersions(this.runtime.appVersion, parsed.minimum_supported_version) < 0) throw new Error('A manual upgrade is required for this version');
    if (!isRolloutEligible(this.deviceId, this.runtime.channel, parsed.rollout_percent)) return null;
    return parsed;
  }

  async fetchBytes(url) {
    const response = await this.fetch(url, { signal: AbortSignal.timeout(15_000), redirect: 'follow' });
    if (!response.ok) throw new Error(`Updater metadata request failed (${response.status})`);
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > MAX_METADATA_BYTES) throw new Error('Updater metadata is too large');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 1 || bytes.length > MAX_METADATA_BYTES) throw new Error('Updater metadata is invalid');
    return bytes;
  }

  async check() {
    if (!this.app.isPackaged) return this.status;
    if (!this.baseUrl) throw new Error('Update service is not configured');
    this.status = { state: 'checking', channel: this.runtime.channel, available: null };
    const response = await this.fetch(`${this.baseUrl}/v1/updates/windows/x64/${this.runtime.channel}/latest`, { signal: AbortSignal.timeout(15_000) });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 404) return (this.status = { state: 'idle', channel: this.runtime.channel, available: null });
    if (!response.ok) throw new Error(`Update check failed (${response.status})`);
    const manifest = this.verify(payload);
    if (!manifest) return (this.status = { state: 'idle', channel: this.runtime.channel, available: null });
    const metadata = await this.fetchBytes(manifest.updater_metadata.url);
    if (crypto.createHash('sha256').update(metadata).digest('hex') !== manifest.updater_metadata.sha256) {
      throw new Error('Updater metadata hash does not match the signed manifest');
    }
    this.updater.channel = this.runtime.channel === 'stable' ? 'latest' : 'pilot';
    this.updater.setFeedURL({ provider: 'generic', url: new URL('.', manifest.updater_metadata.url).href });
    const result = await this.updater.checkForUpdates();
    validateUpdaterInfo(result?.updateInfo, manifest);
    this.verifiedManifest = manifest;
    this.status = {
      state: 'available', channel: this.runtime.channel,
      available: { version: manifest.version, buildId: manifest.build_id, releaseNotes: manifest.release_notes },
    };
    return this.status;
  }

  async download() {
    if (this.status.state !== 'available' || !this.verifiedManifest) throw new Error('No verified update is available');
    this.cancellationToken = new electronUpdater.CancellationToken();
    const downloaded = await this.updater.downloadUpdate(this.cancellationToken);
    const filePath = Array.isArray(downloaded) ? downloaded[0] : null;
    const artifact = this.verifiedManifest.artifacts[0];
    if (!filePath || path.basename(filePath) !== artifact.filename) throw new Error('Downloaded update path is invalid');
    const stat = await fs.promises.stat(filePath);
    const [sha256, sha512] = await Promise.all([
      hashFile(filePath, 'sha256', 'hex'), hashFile(filePath, 'sha512', 'base64'),
    ]);
    if (stat.size !== artifact.size || sha256 !== artifact.sha256 || sha512 !== artifact.sha512) {
      await fs.promises.rm(filePath, { force: true });
      throw new Error('Downloaded update failed integrity verification');
    }
    this.downloadedFile = filePath;
    this.status = { ...this.status, state: 'downloaded', percent: 100 };
    return this.status;
  }

  cancel() {
    if (this.cancellationToken) this.cancellationToken.cancel();
    this.cancellationToken = null; this.downloadedFile = null;
    this.status = { ...this.status, state: 'available', percent: undefined };
    return this.status;
  }

  async install() {
    if (this.status.state !== 'downloaded' || !this.verifiedManifest || !this.downloadedFile) {
      throw new Error('The verified update has not been downloaded');
    }
    const recoveryPath = await this.createPreUpdateBackup();
    const recoverySha256 = await hashFile(recoveryPath, 'sha256', 'hex');
    const licenseStatus = this.getLicenseStatus();
    const journal = {
      schemaVersion: 1, state: 'installing', sourceBuildId: this.runtime.buildId,
      targetBuildId: this.verifiedManifest.build_id, targetVersion: this.verifiedManifest.version,
      recoveryPath, recoverySha256, artifactSha256: this.verifiedManifest.artifacts[0].sha256,
      sourceActivationId: licenseStatus?.activationId || null,
      sourceLicenseState: licenseStatus?.state || 'unactivated',
      updatedAt: new Date().toISOString(),
    };
    await writeDurably(this.journalPath, `${JSON.stringify(journal, null, 2)}\n`);
    setImmediate(() => this.updater.quitAndInstall(false, true));
    return { installing: true };
  }

  async reconcile() {
    let journal;
    try { journal = JSON.parse(await fs.promises.readFile(this.journalPath, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return; throw new Error('Update recovery journal is invalid'); }
    if (journal?.schemaVersion !== 1) throw new Error('Update recovery journal is invalid');
    if (journal.state === 'verification_failed') {
      throw new Error('The installed update did not pass first-launch verification; the recovery point was preserved');
    }
    if (journal.state !== 'installing') return;
    const recoverySha256 = await hashFile(journal.recoveryPath, 'sha256', 'hex');
    if (recoverySha256 !== journal.recoverySha256) throw new Error('Pre-update recovery point is corrupt');
    if (this.runtime.buildId !== journal.targetBuildId || this.runtime.appVersion !== journal.targetVersion) {
      journal.state = 'install_failed';
      journal.updatedAt = new Date().toISOString();
      await writeDurably(this.journalPath, `${JSON.stringify(journal, null, 2)}\n`);
      return;
    }
    this.pendingReconciliation = journal;
  }

  async completeReconciliation({ readiness, licenseStatus = this.getLicenseStatus() }) {
    const journal = this.pendingReconciliation;
    if (!journal) return;
    try {
      if (
        this.runtime.buildId !== journal.targetBuildId
        || this.runtime.appVersion !== journal.targetVersion
        || readiness?.status !== 'ready'
        || readiness?.buildId !== journal.targetBuildId
        || readiness?.database?.status !== 'ok'
        || readiness?.database?.integrity !== 'ok'
        || readiness?.solver?.status !== 'ok'
        || readiness?.licenseVerifier?.status !== 'ok'
      ) throw new Error('Updated runtime readiness verification failed');

      const knownLicenseStates = new Set([
        'unactivated', 'active', 'renewal_due', 'grace', 'expired', 'revoked', 'disabled',
        'device_mismatch', 'clock_suspect',
      ]);
      if (!licenseStatus || !knownLicenseStates.has(licenseStatus.state)) {
        throw new Error('Updated runtime license verification failed');
      }
      if (journal.sourceActivationId && licenseStatus.activationId !== journal.sourceActivationId) {
        throw new Error('The activation identity changed during the update');
      }

      journal.state = 'committed';
      journal.verifiedAt = new Date().toISOString();
      journal.verification = {
        buildId: readiness.buildId,
        databaseSchema: readiness.database.schema?.migrationName || readiness.database.schemaVersion,
        solverVersion: readiness.solver.version,
        licenseState: licenseStatus.state,
        activationPreserved: journal.sourceActivationId === null
          ? licenseStatus.activationId === null
          : licenseStatus.activationId === journal.sourceActivationId,
      };
      journal.updatedAt = journal.verifiedAt;
      await writeDurably(this.journalPath, `${JSON.stringify(journal, null, 2)}\n`);
      this.pendingReconciliation = null;
    } catch (error) {
      journal.state = 'verification_failed';
      journal.updatedAt = new Date().toISOString();
      await writeDurably(this.journalPath, `${JSON.stringify(journal, null, 2)}\n`);
      this.pendingReconciliation = null;
      throw error;
    }
  }
}

module.exports = { UpdateManager, hashFile, writeDurably };
