const assert = require('node:assert/strict');
const test = require('node:test');
const { IPC_CONTRACTS, IPC_ERROR_CODES, IpcContractError } = require('../ipc-contracts');

test('every desktop channel has a unique stable operation failure code', () => {
  assert.equal(Object.keys(IPC_CONTRACTS).length, 17);
  const failureCodes = Object.values(IPC_CONTRACTS).map((contract) => contract.failureCode);
  assert.equal(new Set(failureCodes).size, failureCodes.length);
  failureCodes.forEach((code) => assert.equal(IPC_ERROR_CODES.includes(code), true));
});

test('no-payload channels reject unexpected data', () => {
  for (const channel of ['runtime:get', 'documents:print', 'license:refresh', 'updates:check']) {
    assert.equal(IPC_CONTRACTS[channel].parseRequest(undefined), undefined);
    assert.throws(() => IPC_CONTRACTS[channel].parseRequest({}), IpcContractError);
  }
});

test('license and backup contracts enforce boundaries and strict objects', () => {
  assert.equal(IPC_CONTRACTS['license:activate'].parseRequest({ licenseKey: 'x'.repeat(16) }).licenseKey.length, 16);
  assert.throws(() => IPC_CONTRACTS['license:activate'].parseRequest({ licenseKey: 'x'.repeat(15) }), IpcContractError);
  assert.throws(() => IPC_CONTRACTS['license:activate'].parseRequest({ licenseKey: 'x'.repeat(16), extra: true }), IpcContractError);
  assert.throws(() => IPC_CONTRACTS['license:activate'].parseRequest(Object.assign(Object.create({ polluted: true }), { licenseKey: 'x'.repeat(16) })), IpcContractError);
  assert.equal(IPC_CONTRACTS['data:create-backup'].parseRequest({ passphrase: 'correct horse battery' }).passphrase.length, 21);
  assert.throws(() => IPC_CONTRACTS['data:create-backup'].parseRequest({ passphrase: 'a'.repeat(1_025) }), IpcContractError);
  assert.throws(() => IPC_CONTRACTS['data:restore-backup'].parseRequest({ handle: 'not-a-uuid', passphrase: 'correct horse battery' }), IpcContractError);
});

test('PDF filenames reject traversal and control characters', () => {
  assert.deepEqual(IPC_CONTRACTS['documents:save-pdf'].parseRequest({ suggestedName: 'grade-7.pdf' }), { suggestedName: 'grade-7.pdf' });
  for (const suggestedName of ['../secret.pdf', '..\\secret.pdf', 'bad\u0000.pdf', 'x'.repeat(121)]) {
    assert.throws(() => IPC_CONTRACTS['documents:save-pdf'].parseRequest({ suggestedName }), IpcContractError);
  }
});
