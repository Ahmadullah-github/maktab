const assert = require('node:assert/strict');
const test = require('node:test');
const { DataSource } = require('typeorm');

const { createApp } = require('../dist/src/app');
const { AppDataSource } = require('../dist/ormconfig');
const {
  LOCAL_API_ERROR_CODES,
  normalizeErrorBody,
} = require('../dist/src/errors/localApiError');

function requestContext() {
  return { requestContext: { requestId: 'reliability-correlation-id' } };
}

test('the stable local API error registry covers every reliability category', () => {
  for (const code of [
    'VALIDATION_ERROR',
    'NOT_FOUND',
    'CONFLICT',
    'REQUEST_TOO_LARGE',
    'OPERATION_CANCELLED',
    'OPERATION_TIMEOUT',
    'SOLVER_RUNTIME_ERROR',
    'EXPORT_TIMEOUT',
    'STORAGE_UNAVAILABLE',
    'INTERNAL_ERROR',
  ]) {
    assert.equal(LOCAL_API_ERROR_CODES.includes(code), true, code);
  }
});

test('legacy route failures are normalized without losing domain details', () => {
  const normalized = normalizeErrorBody(requestContext(), 409, {
    code: 'GRADE_BAND_IN_USE',
    message: 'The grade band is in use',
    band: 'primary',
    classCount: 2,
    conflicts: [{ classId: 7 }],
  });
  assert.deepEqual(normalized, {
    success: false,
    error: {
      code: 'GRADE_BAND_IN_USE',
      message: 'The grade band is in use',
      correlationId: 'reliability-correlation-id',
      retryable: false,
      details: {
        band: 'primary',
        classCount: 2,
        conflicts: [{ classId: 7 }],
      },
    },
  });
});

test('unknown and removed local API routes return the standard 404 envelope', async () => {
  const dataSource = new DataSource({ ...AppDataSource.options, database: ':memory:' });
  await dataSource.initialize();
  const app = createApp({ dataSource, enableCors: false });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const address = server.address();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/local-api/v1/teacher-assignments`
    );
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.equal(typeof body.error.correlationId, 'string');
    assert.equal(body.error.retryable, false);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
    await dataSource.destroy();
  }
});
