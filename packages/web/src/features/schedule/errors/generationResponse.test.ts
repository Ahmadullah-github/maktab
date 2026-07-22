import { createClientIssue } from '@/types/operation';
import {
  parseSolverResponse,
  type GeneratedScheduleData,
  type QualityScore,
} from '@/types/solver';
import { describe, expect, it } from 'vitest';

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: 1,
    outcome: 'failed',
    data: null,
    issues: [createClientIssue('MISSING_ROOM_TYPE')],
    diagnosticId: 'request-123',
    metadata: {},
    ...overrides,
  };
}

function generatedData(): GeneratedScheduleData {
  return {
    timetable: {
      schedule: [],
      metadata: {},
      statistics: {},
      status: 'success',
      quality_score: null,
    },
    savedTimetable: {
      id: 12,
      name: 'Generated timetable',
      description: '',
      data: {},
      schoolId: null,
      academicYearId: null,
      termId: null,
      revision: 1,
      createdAt: '2026-07-21T00:00:00.000Z',
      updatedAt: '2026-07-21T00:00:00.000Z',
    },
  };
}

function persistedQualityScore(): QualityScore {
  return {
    overall: 81,
    breakdown: {
      teacher_gaps: { count: 39, penalty: 39, details: [] },
      afternoon_difficult_subjects: { count: 5, penalty: 5, details: [] },
      same_day_subject_repetition: { count: 0, penalty: 0, details: [] },
      teacher_load_balance: { count: 48, penalty: 48, details: [] },
    },
    objective_results: [
      {
        key: 'avoidClassGaps',
        strength: 2,
        violation_units: 0,
        opportunity_units: 132,
        satisfaction_percent: 100,
        affected_entities: [],
      },
    ],
    // Existing persisted rows may predate stable suggestion-code serialization.
    suggestions: [{ affected_entities: [], expected_improvement: 10 }],
  };
}

describe('generation response boundary', () => {
  it('normalizes rejected pre-solve data so it cannot be rendered as a timetable', () => {
    const parsed = parseSolverResponse(
      envelope({
        data: { canProceed: false, analysisTimeMs: 8, suggestions: [] },
      })
    );

    expect(parsed?.outcome).toBe('failed');
    expect(parsed?.data).toBeNull();
    expect(parsed?.issues[0].code).toBe('MISSING_ROOM_TYPE');
  });

  it('accepts future issue codes through the generic user-safe fallback path', () => {
    const unknownIssue = {
      ...createClientIssue('FUTURE_SOLVER_REJECTION'),
      category: 'solver',
      phase: 'solving',
    };
    const parsed = parseSolverResponse(envelope({ issues: [unknownIssue] }));

    expect(parsed?.issues[0].code).toBe('FUTURE_SOLVER_REJECTION');
    expect(parsed?.data).toBeNull();
  });

  it('accepts complete generated data for success and partial outcomes', () => {
    for (const outcome of ['success', 'partial']) {
      const parsed = parseSolverResponse(envelope({ outcome, data: generatedData(), issues: [] }));
      expect(parsed?.outcome).toBe(outcome);
      expect(parsed?.data?.savedTimetable.id).toBe(12);
    }
  });

  it('accepts the canonical persisted schedule and language-neutral quality payload', () => {
    const data = generatedData();
    data.timetable.schedule = Array.from({ length: 204 }, (_, periodIndex) => ({ periodIndex }));
    data.timetable.quality_score = persistedQualityScore();

    const parsed = parseSolverResponse(envelope({ outcome: 'success', data, issues: [] }));

    expect(parsed?.data?.timetable.schedule).toHaveLength(204);
    expect(parsed?.data?.timetable.quality_score?.overall).toBe(81);
  });

  it('rejects successful envelopes without a generated timetable', () => {
    expect(parseSolverResponse(envelope({ outcome: 'success', data: { canProceed: true } }))).toBeNull();
    expect(parseSolverResponse(envelope({ outcome: 'partial', data: null }))).toBeNull();
  });
});
