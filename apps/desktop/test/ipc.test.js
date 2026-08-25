const assert = require('node:assert/strict');
const test = require('node:test');
const { registerIpc } = require('../ipc');

function fixture(overrides = {}) {
  const handlers = new Map();
  const mainFrame = { url: 'http://127.0.0.1:41234/' };
  const webContents = { mainFrame, print: () => undefined, printToPDF: async () => Buffer.from('pdf') };
  const win = { webContents };
  const runtimeInfo = {
    schemaVersion: 1, productMode: 'desktop-timetable', packaged: true, appVersion: '1.0.0', buildId: 'test',
    channel: 'development', platform: 'win32', arch: 'x64',
    capabilities: { localTimetable: true, platform: false, nativePrint: true, backupRestore: true, licensing: true, updates: true, diagnostics: true },
  };
  registerIpc({
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    dialog: { showSaveDialog: async () => ({ canceled: true }) },
    getMainWindow: () => win,
    getRendererOrigin: () => 'http://127.0.0.1:41234',
    runtimeInfo,
    licenseManager: { publicStatus: () => overrides.licenseStatus || { state: 'unactivated', canGenerate: false, isReadOnly: false, expiresAt: null, graceUntil: null, keyId: null, activationId: null, message: 'Activation required.' }, activate: overrides.activate || (async () => { throw new Error('service detail'); }), refresh: async () => ({}), deactivate: async () => ({}) },
    backupManager: { create: async () => ({ canceled: true }), selectAndInspect: async () => ({ canceled: true }), restoreHandle: async () => ({}) },
    diagnosticsManager: { getStatus: () => overrides.diagnosticsStatus || {}, exportBundle: async () => ({ canceled: true }) },
    updateManager: { getStatus: () => ({ state: 'idle', channel: 'development', available: null }), check: async () => ({}), download: async () => ({}), cancel: () => ({}), install: async () => ({ installing: true }) },
  });
  return { handlers, event: { sender: webContents, senderFrame: mainFrame }, runtimeInfo };
}

test('trusted IPC call validates and returns a typed result', async () => {
  const { handlers, event, runtimeInfo } = fixture();
  assert.deepEqual(await handlers.get('runtime:get')(event), { ok: true, value: runtimeInfo });
});

test('invalid payload and untrusted frames receive stable sanitized codes', async (t) => {
  t.mock.method(console, 'error', () => undefined);
  const { handlers, event } = fixture();
  const invalid = await handlers.get('license:activate')(event, { licenseKey: 'short' });
  assert.equal(invalid.ok, false); assert.equal(invalid.error.code, 'IPC_INVALID_PAYLOAD');
  assert.doesNotMatch(invalid.error.message, /short|service detail/);
  const untrusted = await handlers.get('runtime:get')({ ...event, senderFrame: { url: 'https://evil.example' } });
  assert.equal(untrusted.ok, false); assert.equal(untrusted.error.code, 'IPC_UNTRUSTED_SENDER');
});

test('handler failures and invalid responses are separated', async (t) => {
  t.mock.method(console, 'error', () => undefined);
  const { handlers, event } = fixture();
  const failed = await handlers.get('license:activate')(event, { licenseKey: 'x'.repeat(16) });
  assert.equal(failed.error.code, 'LICENSE_ACTIVATE_FAILED');
  assert.doesNotMatch(failed.error.message, /service detail/);
  const invalidResponse = await handlers.get('diagnostics:get-status')(event);
  assert.equal(invalidResponse.error.code, 'IPC_INVALID_RESPONSE');
});

test('recognized transient handler failures are retryable without leaking details', async (t) => {
  t.mock.method(console, 'error', () => undefined);
  const transient = new Error('private network detail');
  transient.retryable = true;
  const { handlers, event } = fixture({ activate: async () => { throw transient; } });
  const result = await handlers.get('license:activate')(event, { licenseKey: 'x'.repeat(16) });
  assert.equal(result.error.code, 'LICENSE_ACTIVATE_FAILED');
  assert.equal(result.error.retryable, true);
  assert.doesNotMatch(result.error.message, /private network detail/);
});
