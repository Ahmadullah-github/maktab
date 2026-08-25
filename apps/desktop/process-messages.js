const STARTUP_STAGES = new Set(['backup', 'migration', 'integrity', 'solver', 'listening']);
const HASH_PATTERN = /^[a-f0-9]{64}$/;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactKeys(value, keys) {
  return Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}

function parseApiProcessMessage(value) {
  if (!isPlainObject(value) || typeof value.type !== 'string') return null;
  if (value.type === 'api-startup-progress') {
    return hasExactKeys(value, ['type', 'stage']) && STARTUP_STAGES.has(value.stage) ? value : null;
  }
  if (value.type === 'api-error') {
    return hasExactKeys(value, ['type', 'message']) && typeof value.message === 'string' && value.message.length <= 1_000
      ? value
      : null;
  }
  if (value.type === 'api-ready') {
    if (!hasExactKeys(value, ['type', 'protocolVersion', 'host', 'port', 'pid', 'buildId', 'dbSchema', 'solver'])) return null;
    if (
      value.protocolVersion !== 1 ||
      value.host !== '127.0.0.1' ||
      !Number.isInteger(value.port) || value.port < 1 || value.port > 65_535 ||
      !Number.isInteger(value.pid) || value.pid < 1 ||
      typeof value.buildId !== 'string' || value.buildId.length < 1 || value.buildId.length > 256 ||
      !Number.isInteger(value.dbSchema) || value.dbSchema < 0 ||
      !isPlainObject(value.solver) ||
      !hasExactKeys(value.solver, ['version', 'sha256']) ||
      typeof value.solver.version !== 'string' || value.solver.version.length > 128 ||
      typeof value.solver.sha256 !== 'string' || !HASH_PATTERN.test(value.solver.sha256)
    ) return null;
    return value;
  }
  return null;
}

module.exports = { parseApiProcessMessage };
