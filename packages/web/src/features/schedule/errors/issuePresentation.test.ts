import { describe, expect, it } from 'vitest';
import { createClientIssue, parseOperationResponse, type OperationIssue } from '@/types/operation';
import { getIssueAction, prioritizeIssues } from './issuePresentation';

function issue(code: string, overrides: Partial<OperationIssue> = {}): OperationIssue {
  return {
    ...createClientIssue(code),
    category: 'teacher',
    ...overrides,
  };
}

describe('operation response parsing', () => {
  it('accepts only the versioned issue contract', () => {
    const response = {
      contractVersion: 1,
      outcome: 'failed',
      data: null,
      issues: [issue('TEACHER_OVERLOAD')],
      diagnosticId: 'request-123',
      metadata: {},
    };

    expect(parseOperationResponse(response)).toEqual(response);
    expect(parseOperationResponse({ ...response, contractVersion: 2 })).toBeNull();
    expect(parseOperationResponse({ status: 'failed', errors: ['legacy'] })).toBeNull();
  });
});

describe('issue presentation', () => {
  it('puts blocking corrective issues first and removes duplicates', () => {
    const warning = issue('ROOM_CAPACITY_WARNING', {
      category: 'room',
      severity: 'warning',
      blocking: false,
    });
    const overload = issue('TEACHER_OVERLOAD');
    const prioritized = prioritizeIssues([warning, overload, overload]);

    expect(prioritized.map((item) => item.code)).toEqual([
      'TEACHER_OVERLOAD',
      'ROOM_CAPACITY_WARNING',
    ]);
  });

  it('builds a focused editor action from an affected entity', () => {
    const action = getIssueAction(
      issue('TEACHER_OVERLOAD', {
        affectedEntities: [{ type: 'teacher', id: '7', name: 'Amina' }],
      })
    );

    expect(action).toMatchObject({
      type: 'edit_teacher',
      entity: { type: 'teacher', id: '7', name: 'Amina' },
    });
  });
});
