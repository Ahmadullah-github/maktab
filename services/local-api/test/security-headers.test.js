const assert = require('node:assert/strict');
const test = require('node:test');
const {
  DESKTOP_CONTENT_SECURITY_POLICY,
  DESKTOP_PERMISSIONS_POLICY,
} = require('../dist/src/securityHeaders.js');

test('packaged renderer security headers remain restrictive', () => {
  assert.match(DESKTOP_CONTENT_SECURITY_POLICY, /default-src 'self'/);
  assert.match(DESKTOP_CONTENT_SECURITY_POLICY, /script-src 'self'/);
  assert.doesNotMatch(DESKTOP_CONTENT_SECURITY_POLICY, /script-src[^;]*unsafe-inline/);
  assert.doesNotMatch(DESKTOP_CONTENT_SECURITY_POLICY, /unsafe-eval/);
  assert.match(DESKTOP_CONTENT_SECURITY_POLICY, /style-src-attr 'unsafe-inline'/);
  assert.match(DESKTOP_CONTENT_SECURITY_POLICY, /object-src 'none'/);
  assert.match(DESKTOP_CONTENT_SECURITY_POLICY, /frame-src 'none'/);
  assert.match(DESKTOP_CONTENT_SECURITY_POLICY, /form-action 'self'/);
  for (const capability of ['camera', 'microphone', 'geolocation', 'display-capture', 'usb', 'serial', 'hid', 'bluetooth']) {
    assert.match(DESKTOP_PERMISSIONS_POLICY, new RegExp(`${capability}=\\(\\)`));
  }
});
