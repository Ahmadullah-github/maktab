const assert = require('node:assert/strict');
const test = require('node:test');
const { parseApiProcessMessage } = require('../process-messages');

test('utility-process messages accept only the typed startup protocol', () => {
  assert.deepEqual(parseApiProcessMessage({ type: 'api-startup-progress', stage: 'solver' }), { type: 'api-startup-progress', stage: 'solver' });
  const ready = {
    type: 'api-ready', protocolVersion: 1, host: '127.0.0.1', port: 40123, pid: 100,
    buildId: '1.0.0-test', dbSchema: 4, solver: { version: '1.0.0', sha256: 'a'.repeat(64) },
  };
  assert.equal(parseApiProcessMessage(ready), ready);
  for (const invalid of [
    null, [], { type: 'api-startup-progress', stage: 'unknown' },
    { ...ready, port: 0 }, { ...ready, host: 'localhost' }, { ...ready, extra: true },
    { type: 'api-error', message: 'x', extra: true }, { type: 'api-shutdown' },
  ]) assert.equal(parseApiProcessMessage(invalid), null);
});
