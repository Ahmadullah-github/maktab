const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');

const {
  createDevelopmentLicenseStatus,
  isDevelopmentLicenseBypassEnabled,
} = require('../dist/src/utils/developmentLicense');
const {
  generateGuardMiddleware,
  licenseMiddleware,
} = require('../dist/src/middleware/licenseMiddleware');
const { createLicenseRouter } = require('../dist/src/routes');

async function withEnvironment(values, callback) {
  const originalValues = new Map();

  for (const [name, value] of Object.entries(values)) {
    originalValues.set(name, process.env[name]);
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }

  try {
    return await callback();
  } finally {
    for (const [name, value] of originalValues) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}

test('development mode bypasses license restrictions by default', async () => {
  await withEnvironment(
    { NODE_ENV: 'development', MAKTAB_ENFORCE_LICENSE_IN_DEV: undefined },
    () => {
      assert.equal(isDevelopmentLicenseBypassEnabled(), true);
      assert.deepEqual(createDevelopmentLicenseStatus(), {
        mode: 'licensed',
        isReadOnly: false,
        canGenerate: true,
        trial: null,
        license: null,
        message: 'Development license bypass active',
        messageType: 'success',
        showBanner: false,
        bannerType: null,
      });
    }
  );
});

test('production mode can never use the development license bypass', async () => {
  await withEnvironment(
    { NODE_ENV: 'production', MAKTAB_ENFORCE_LICENSE_IN_DEV: 'false' },
    () => assert.equal(isDevelopmentLicenseBypassEnabled(), false)
  );
});

test('license enforcement can be restored for development license testing', async () => {
  await withEnvironment(
    { NODE_ENV: 'development', MAKTAB_ENFORCE_LICENSE_IN_DEV: 'true' },
    () => assert.equal(isDevelopmentLicenseBypassEnabled(), false)
  );
});

test('development status route and generation guard share the unrestricted status', async () => {
  await withEnvironment(
    { NODE_ENV: 'development', MAKTAB_ENFORCE_LICENSE_IN_DEV: undefined },
    async () => {
      const app = express();
      app.use(express.json());
      app.use('/api/license', createLicenseRouter());
      app.use(licenseMiddleware);
      app.post('/api/generate/test', generateGuardMiddleware, (_req, res) => {
        res.json({ allowed: true });
      });

      const server = await new Promise((resolve) => {
        const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
      });

      try {
        const address = server.address();
        assert.ok(address && typeof address !== 'string');
        const baseUrl = `http://127.0.0.1:${address.port}`;

        const statusResponse = await fetch(
          `${baseUrl}/api/license/status?machineId=EXPIRED-DEVELOPMENT-MACHINE`
        );
        assert.equal(statusResponse.status, 200);
        assert.equal(statusResponse.headers.get('x-license-development-bypass'), 'true');
        assert.deepEqual(await statusResponse.json(), createDevelopmentLicenseStatus());

        const generateResponse = await fetch(`${baseUrl}/api/generate/test`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        });
        assert.equal(generateResponse.status, 200);
        assert.equal(generateResponse.headers.get('x-license-development-bypass'), 'true');
        assert.deepEqual(await generateResponse.json(), { allowed: true });
      } finally {
        await new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    }
  );
});
