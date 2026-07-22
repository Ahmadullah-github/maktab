const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createOperationIssue,
  createOperationResponse,
  isOperationResponse,
  withDiagnosticId,
} = require('../dist/src/types/operation.types.js');

test('operation response has stable v1 fields and request diagnostic ID', () => {
  const response = createOperationResponse('failed', 'solver-process', {
    issues: [
      createOperationIssue('TEACHER_OVERLOAD', 'analysis', {
        messageParams: { requiredPeriods: 30, availablePeriods: 20 },
        affectedEntities: [{ type: 'teacher', id: '7', name: 'Amina' }],
      }),
    ],
  });
  const publicResponse = withDiagnosticId(response, 'request-123');

  assert.equal(isOperationResponse(publicResponse), true);
  assert.equal(publicResponse.contractVersion, 1);
  assert.equal(publicResponse.diagnosticId, 'request-123');
  assert.equal(publicResponse.issues[0].category, 'teacher');
  assert.equal(JSON.stringify(publicResponse).includes('message_farsi'), false);
});

test('legacy and incomplete payloads are rejected', () => {
  assert.equal(isOperationResponse({ status: 'failed', errors: ['legacy'] }), false);
  assert.equal(
    isOperationResponse({
      contractVersion: 1,
      outcome: 'failed',
      data: null,
      issues: [{ code: 'INCOMPLETE' }],
      diagnosticId: 'request-123',
      metadata: {},
    }),
    false
  );
});

test('failed operations never expose success-domain data', () => {
  const response = createOperationResponse('failed', 'request-123', {
    data: { timetable: { unsafe: true } },
    issues: [createOperationIssue('MISSING_ROOM_TYPE', 'analysis')],
    metadata: { analysis: { canProceed: false } },
  });

  assert.equal(response.data, null);
  assert.deepEqual(response.metadata, { analysis: { canProceed: false } });
  assert.equal(response.issues[0].code, 'MISSING_ROOM_TYPE');
});
