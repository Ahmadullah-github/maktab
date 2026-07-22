require('reflect-metadata');

const assert = require('node:assert/strict');
const test = require('node:test');
const { DataSource } = require('typeorm');
const express = require('express');
const { CacheManager } = require('../dist/src/database/cache/cacheManager');
const { SchoolProfile } = require('../dist/src/entity/SchoolProfile');
const {
  SchoolProfileAlreadyConfiguredError,
  SchoolProfileRevisionConflictError,
  SchoolProfileService,
} = require('../dist/src/services/schoolProfile.service');
const {
  InvalidSchoolLogoError,
  validateSchoolLogoBytes,
} = require('../dist/src/services/schoolLogoStorage.service');
const { createConfigRoutes } = require('../dist/src/routes/config.routes');

function profileInput(overrides = {}) {
  return {
    officialName: '  Kabul Model School  ',
    shortName: '',
    nameFa: 'مکتب نمونه کابل',
    namePs: null,
    nameEn: 'Kabul Model School',
    schoolCode: 'KMS-01',
    address: 'Kabul',
    phone: null,
    email: null,
    website: null,
    defaultLanguage: 'fa',
    ...overrides,
  };
}

test('school profile is a required singleton with optimistic revision checks', async () => {
  const dataSource = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: [SchoolProfile],
    synchronize: true,
  });
  await dataSource.initialize();

  try {
    const service = new SchoolProfileService(dataSource, new CacheManager());
    assert.deepEqual(await service.getStatus(), { configured: false, profile: null });

    const created = await service.create(profileInput());
    assert.equal(created.officialName, 'Kabul Model School');
    assert.equal(created.shortName, null);
    assert.equal(created.revision, 1);

    await assert.rejects(
      () => service.create(profileInput()),
      SchoolProfileAlreadyConfiguredError
    );
    await assert.rejects(
      () => service.update({ ...profileInput(), officialName: 'Changed', revision: 99 }),
      SchoolProfileRevisionConflictError
    );

    const updated = await service.update({
      ...profileInput(),
      officialName: 'Kabul Model High School',
      revision: created.revision,
    });
    assert.equal(updated.officialName, 'Kabul Model High School');
    assert.equal(updated.revision, 2);
  } finally {
    await dataSource.destroy();
  }
});

test('school logo validation checks both declared MIME type and file signature', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.doesNotThrow(() => validateSchoolLogoBytes(png, 'image/png'));
  assert.throws(() => validateSchoolLogoBytes(png, 'image/jpeg'), InvalidSchoolLogoError);
  assert.throws(
    () => validateSchoolLogoBytes(Buffer.from('not-an-image'), 'image/webp'),
    InvalidSchoolLogoError
  );
});

test('school profile HTTP flow creates identity and uploads a revision-protected logo', async () => {
  const dataSource = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: [SchoolProfile],
    synchronize: true,
  });
  await dataSource.initialize();
  const app = express();
  app.use(express.json());
  app.use('/api/config', createConfigRoutes(dataSource, new CacheManager()));
  const server = app.listen(0, '127.0.0.1');
  const address = await new Promise((resolve, reject) => {
    server.once('listening', () => resolve(server.address()));
    server.once('error', reject);
  });

  try {
    assert.ok(address && typeof address !== 'string');
    const baseUrl = `http://127.0.0.1:${address.port}/api/config/school-profile`;

    const initial = await fetch(baseUrl);
    assert.deepEqual(await initial.json(), { configured: false, profile: null });

    const createResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(profileInput({ officialName: 'Route School' })),
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();
    assert.equal(created.revision, 1);

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const uploadResponse = await fetch(`${baseUrl}/logo`, {
      method: 'PUT',
      headers: { 'content-type': 'image/png', 'if-match': '1' },
      body: png,
    });
    assert.equal(uploadResponse.status, 200);
    const uploaded = await uploadResponse.json();
    assert.equal(uploaded.revision, 2);
    assert.equal(uploaded.logoUrl, '/api/config/school-profile/logo?v=1');

    const staleUpload = await fetch(`${baseUrl}/logo`, {
      method: 'PUT',
      headers: { 'content-type': 'image/png', 'if-match': '1' },
      body: png,
    });
    assert.equal(staleUpload.status, 409);

    const logoResponse = await fetch(`${baseUrl}/logo`);
    assert.equal(logoResponse.status, 200);
    assert.equal(logoResponse.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await logoResponse.arrayBuffer()), png);

    const deleteResponse = await fetch(`${baseUrl}/logo`, {
      method: 'DELETE',
      headers: { 'if-match': '2' },
    });
    assert.equal(deleteResponse.status, 200);
    assert.equal((await deleteResponse.json()).logoUrl, null);
  } finally {
    if (server.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await dataSource.destroy();
  }
});
