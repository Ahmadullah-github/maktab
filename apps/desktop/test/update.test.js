const assert = require('node:assert/strict');
const test = require('node:test');
const { compareVersions } = require('../update-contract');

test('electron-updater compatibility keeps deterministic version ordering', () => {
  assert.equal(compareVersions('43.4.1', '43.4.0'), 1);
  assert.equal(compareVersions('1.0.0', '1.0'), 0);
  assert.equal(compareVersions('1.0.0', '1.0.1'), -1);
});
