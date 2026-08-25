const crypto = require('crypto');

const MAX_RESPONSE_BYTES = 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

class IpcContractError extends Error {
  constructor(message) {
    super(message);
    this.name = 'IpcContractError';
    this.code = 'IPC_INVALID_PAYLOAD';
  }
}

function invalid(message = 'IPC contract validation failed') {
  throw new IpcContractError(message);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function strictObject(value, required = [], optional = []) {
  if (!isPlainObject(value)) invalid('Expected a plain object');
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  if (required.some((key) => !Object.hasOwn(value, key)) || keys.some((key) => !allowed.has(key))) {
    invalid('Object keys do not match the contract');
  }
  return value;
}

function string(value, { min = 0, max = 1_024, nullable = false } = {}) {
  if (nullable && value === null) return value;
  if (typeof value !== 'string' || value.length < min || value.length > max) invalid('String is outside contract limits');
  return value;
}

function boolean(value) {
  if (typeof value !== 'boolean') invalid('Expected a boolean');
  return value;
}

function finiteNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid('Expected a finite number');
  return value;
}

function noPayload(value) {
  if (value !== undefined) invalid('This channel does not accept a payload');
  return undefined;
}

function licenseKeyPayload(value) {
  const payload = strictObject(value, ['licenseKey']);
  string(payload.licenseKey, { min: 16, max: 256 });
  return payload;
}

function passphrasePayload(value) {
  const payload = strictObject(value, ['passphrase']);
  string(payload.passphrase, { min: 12, max: 1_024 });
  const bytes = Buffer.byteLength(payload.passphrase, 'utf8');
  if (bytes < 12 || bytes > 1_024) invalid('Passphrase byte length is outside contract limits');
  return payload;
}

function restorePayload(value) {
  const payload = strictObject(value, ['handle', 'passphrase']);
  if (typeof payload.handle !== 'string' || !UUID_PATTERN.test(payload.handle)) invalid('Restore handle is invalid');
  passphrasePayload({ passphrase: payload.passphrase });
  return payload;
}

function savePdfPayload(value) {
  if (value === undefined) return undefined;
  const payload = strictObject(value, [], ['suggestedName']);
  if (payload.suggestedName !== undefined) {
    string(payload.suggestedName, { min: 1, max: 120 });
    if (/[\\/\u0000-\u001f\u007f]/.test(payload.suggestedName) || payload.suggestedName === '.' || payload.suggestedName === '..') {
      invalid('Suggested PDF name is invalid');
    }
  }
  return payload;
}

function assertJsonValue(value, depth = 0) {
  if (depth > 10) invalid('Response nesting exceeds the contract');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') { finiteNumber(value); return; }
  if (typeof value === 'string') { string(value, { max: 100_000 }); return; }
  if (Array.isArray(value)) {
    if (value.length > 10_000) invalid('Response array exceeds the contract');
    value.forEach((item) => assertJsonValue(item, depth + 1));
    return;
  }
  if (!isPlainObject(value) || Object.keys(value).length > 1_000) invalid('Response contains a non-serializable object');
  Object.values(value).forEach((item) => assertJsonValue(item, depth + 1));
}

function boundedResponse(value) {
  assertJsonValue(value);
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_RESPONSE_BYTES) invalid('Response exceeds the contract size limit');
  return value;
}

function runtimeResponse(value) {
  const runtime = strictObject(value, ['schemaVersion', 'productMode', 'packaged', 'appVersion', 'buildId', 'channel', 'platform', 'arch', 'capabilities']);
  if (runtime.schemaVersion !== 1) invalid();
  string(runtime.productMode, { min: 1, max: 64 }); boolean(runtime.packaged);
  for (const key of ['appVersion', 'buildId', 'channel', 'platform', 'arch']) string(runtime[key], { min: 1, max: 256 });
  const capabilities = strictObject(runtime.capabilities, ['localTimetable', 'platform', 'nativePrint', 'backupRestore', 'licensing', 'updates', 'diagnostics']);
  Object.values(capabilities).forEach(boolean);
  return runtime;
}

function licenseResponse(value) {
  const status = strictObject(value, ['state', 'canGenerate', 'isReadOnly', 'expiresAt', 'graceUntil', 'keyId', 'activationId', 'message']);
  string(status.state, { min: 1, max: 64 }); boolean(status.canGenerate); boolean(status.isReadOnly);
  for (const key of ['expiresAt', 'graceUntil', 'keyId', 'activationId']) string(status[key], { max: 512, nullable: true });
  string(status.message, { max: 2_000 });
  return status;
}

function savePdfResponse(value) {
  const result = strictObject(value, ['canceled'], ['filePath']);
  boolean(result.canceled);
  if (result.filePath !== undefined) string(result.filePath, { min: 1, max: 255 });
  if (result.canceled === (result.filePath !== undefined)) invalid();
  return result;
}

function printedResponse(value) {
  const result = strictObject(value, ['printed']);
  if (result.printed !== true) invalid();
  return result;
}

function diagnosticsResponse(value) {
  const result = strictObject(value, ['runtime', 'components', 'license', 'security']);
  runtimeResponse(result.runtime); licenseResponse(result.license);
  if (isPlainObject(result.components) && result.components.status === 'starting') {
    strictObject(result.components, ['status']);
  } else {
    const components = strictObject(result.components, ['database', 'solver', 'licenseVerifier']);
    strictObject(components.database, ['status', 'schemaVersion', 'schema', 'integrity']);
    const schema = strictObject(components.database.schema, ['migrationId', 'migrationName', 'ordinal']);
    if (!Number.isInteger(schema.migrationId) || schema.migrationId < 0) invalid();
    string(schema.migrationName, { min: 1, max: 128 });
    if (!Number.isInteger(schema.ordinal) || schema.ordinal < 0) invalid();
    strictObject(components.solver, ['status', 'version', 'sha256']);
    strictObject(components.licenseVerifier, ['status', 'keyId']);
    boundedResponse(components);
  }
  const security = strictObject(result.security, ['safeStorage']);
  if (!['ok', 'not-applicable'].includes(security.safeStorage)) invalid();
  return boundedResponse(result);
}

function supportBundleResponse(value) {
  const result = strictObject(value, ['canceled'], ['fileName', 'bytes']); boolean(result.canceled);
  if (!result.canceled) { string(result.fileName, { min: 1, max: 255 }); finiteNumber(result.bytes); }
  else if (result.fileName !== undefined || result.bytes !== undefined) invalid();
  return result;
}

function backupManifestResponse(value) {
  if (!isPlainObject(value)) invalid();
  const manifest = value.format_version === 1
    ? strictObject(value, [
      'format_version', 'created_at', 'app_version', 'build_id', 'db_schema_version',
      'database_sha256', 'database_size', 'source_platform', 'scope',
    ])
    : strictObject(value, [
      'format_version', 'created_at', 'app_version', 'build_id', 'db_schema',
      'database_sha256', 'database_size', 'source_platform', 'scope',
    ]);
  if (![1, 2].includes(manifest.format_version) || manifest.scope !== 'desktop-timetable') invalid();
  for (const key of ['created_at', 'app_version', 'build_id', 'source_platform']) string(manifest[key], { min: 1, max: 256 });
  if (manifest.format_version === 1) {
    if (!Number.isInteger(manifest.db_schema_version) || manifest.db_schema_version < 0) invalid();
  } else {
    const schema = strictObject(manifest.db_schema, ['migration_id', 'migration_name', 'ordinal']);
    if (!Number.isInteger(schema.migration_id) || schema.migration_id < 0) invalid();
    string(schema.migration_name, { min: 1, max: 128 });
    if (!Number.isInteger(schema.ordinal) || schema.ordinal < 0) invalid();
  }
  if (!Number.isInteger(manifest.database_size) || manifest.database_size < 0) invalid();
  if (typeof manifest.database_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.database_sha256)) invalid();
  return manifest;
}

function backupCreateResponse(value) {
  const result = strictObject(value, ['canceled'], ['fileName', 'manifest']); boolean(result.canceled);
  if (!result.canceled) { string(result.fileName, { min: 1, max: 255 }); backupManifestResponse(result.manifest); }
  else if (result.fileName !== undefined || result.manifest !== undefined) invalid();
  return result;
}

function backupInspectResponse(value) {
  const result = strictObject(value, ['canceled'], ['handle', 'manifest']); boolean(result.canceled);
  if (!result.canceled) {
    if (typeof result.handle !== 'string' || !UUID_PATTERN.test(result.handle)) invalid();
    backupManifestResponse(result.manifest);
  } else if (result.handle !== undefined || result.manifest !== undefined) invalid();
  return result;
}

function backupRestoreResponse(value) {
  const result = strictObject(value, ['restored', 'manifest']);
  if (result.restored !== true) invalid(); backupManifestResponse(result.manifest);
  return result;
}

function updateResponse(value) {
  if (isPlainObject(value) && Object.keys(value).length === 1 && value.installing === true) return value;
  const result = strictObject(value, ['state', 'channel', 'available'], ['percent', 'message']);
  string(result.state, { min: 1, max: 64 }); string(result.channel, { min: 1, max: 32 });
  if (result.available !== null) {
    const available = strictObject(result.available, ['version', 'buildId', 'releaseNotes']);
    string(available.version, { min: 1, max: 64 }); string(available.buildId, { min: 1, max: 256 });
    boundedResponse(available.releaseNotes);
  }
  if (result.percent !== undefined) finiteNumber(result.percent);
  if (result.message !== undefined) string(result.message, { max: 2_000 });
  return result;
}

const channelDefinitions = {
  'runtime:get': [noPayload, runtimeResponse, 'RUNTIME_READ_FAILED'],
  'documents:save-pdf': [savePdfPayload, savePdfResponse, 'DOCUMENT_SAVE_PDF_FAILED'],
  'documents:print': [noPayload, printedResponse, 'DOCUMENT_PRINT_FAILED'],
  'diagnostics:get-status': [noPayload, diagnosticsResponse, 'DIAGNOSTICS_STATUS_FAILED'],
  'diagnostics:export-support-bundle': [noPayload, supportBundleResponse, 'DIAGNOSTICS_EXPORT_FAILED'],
  'data:create-backup': [passphrasePayload, backupCreateResponse, 'BACKUP_CREATE_FAILED'],
  'data:inspect-backup': [passphrasePayload, backupInspectResponse, 'BACKUP_INSPECT_FAILED'],
  'data:restore-backup': [restorePayload, backupRestoreResponse, 'BACKUP_RESTORE_FAILED'],
  'license:get-status': [noPayload, licenseResponse, 'LICENSE_STATUS_FAILED'],
  'license:activate': [licenseKeyPayload, licenseResponse, 'LICENSE_ACTIVATE_FAILED'],
  'license:refresh': [noPayload, licenseResponse, 'LICENSE_REFRESH_FAILED'],
  'license:deactivate': [noPayload, licenseResponse, 'LICENSE_DEACTIVATE_FAILED'],
  'updates:get-status': [noPayload, updateResponse, 'UPDATE_STATUS_FAILED'],
  'updates:check': [noPayload, updateResponse, 'UPDATE_CHECK_FAILED'],
  'updates:download': [noPayload, updateResponse, 'UPDATE_DOWNLOAD_FAILED'],
  'updates:cancel': [noPayload, updateResponse, 'UPDATE_CANCEL_FAILED'],
  'updates:install': [noPayload, updateResponse, 'UPDATE_INSTALL_FAILED'],
};

const IPC_CONTRACTS = Object.freeze(Object.fromEntries(Object.entries(channelDefinitions).map(
  ([channel, [parseRequest, parseResponse, failureCode]]) => [channel, Object.freeze({ parseRequest, parseResponse, failureCode })]
)));

const IPC_ERROR_CODES = Object.freeze([
  'IPC_INVALID_PAYLOAD', 'IPC_UNTRUSTED_SENDER', 'IPC_INVALID_RESPONSE', 'IPC_WINDOW_UNAVAILABLE',
  ...Object.values(IPC_CONTRACTS).map((contract) => contract.failureCode),
]);

function newCorrelationId() { return crypto.randomUUID(); }

module.exports = { IPC_CONTRACTS, IPC_ERROR_CODES, IpcContractError, newCorrelationId };
