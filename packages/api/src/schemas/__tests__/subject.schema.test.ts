import { describe, expect, it } from 'vitest';
import { createSubjectSchema, updateSubjectSchema } from '../subject.schema';

describe('subject.schema', () => {
  it('normalizes JSON string fields on create', () => {
    const result = createSubjectSchema.parse({
      name: 'Physics',
      code: 'PHY',
      grade: 10,
      periodsPerWeek: 3,
      section: 'HIGH',
      requiredRoomType: 'physics_lab',
      requiredFeatures: '["projector","lab-bench"]',
      desiredFeatures: '["sink"]',
      isDifficult: true,
      minRoomCapacity: 20,
      meta: '{"source":"custom"}',
    });

    expect(result.requiredFeatures).toEqual(['projector', 'lab-bench']);
    expect(result.desiredFeatures).toEqual(['sink']);
    expect(result.meta).toEqual({ source: 'custom' });
  });

  it('accepts already-parsed fields on update', () => {
    const result = updateSubjectSchema.parse({
      requiredFeatures: ['projector'],
      desiredFeatures: ['sink'],
      meta: { source: 'custom' },
    });

    expect(result.requiredFeatures).toEqual(['projector']);
    expect(result.desiredFeatures).toEqual(['sink']);
    expect(result.meta).toEqual({ source: 'custom' });
  });

  it('rejects malformed JSON strings with a field-level error', () => {
    const result = createSubjectSchema.safeParse({
      name: 'Physics',
      requiredFeatures: '{"not":"an-array"}',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.requiredFeatures).toContain(
        'Must be an array of strings or a JSON string array'
      );
    }
  });
});
