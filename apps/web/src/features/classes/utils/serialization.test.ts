import { describe, expect, it } from 'vitest';
import {
  deserializeSubjectRequirements,
  serializeSubjectRequirements,
} from './serialization';

describe('class subject requirement period mode serialization', () => {
  it('round-trips inherited and class override modes', () => {
    const serialized = serializeSubjectRequirements([
      { subjectId: 1, periodsPerWeek: 5, periodMode: 'inherited' },
      { subjectId: 2, periodsPerWeek: 3, periodMode: 'class_override' },
    ]);

    expect(deserializeSubjectRequirements(serialized)).toEqual([
      { subjectId: 1, periodsPerWeek: 5, periodMode: 'inherited', teacherId: null },
      { subjectId: 2, periodsPerWeek: 3, periodMode: 'class_override', teacherId: null },
    ]);
  });

  it('treats old rows without metadata as inherited', () => {
    expect(deserializeSubjectRequirements('[{"subjectId":1,"periodsPerWeek":5}]')[0].periodMode)
      .toBe('inherited');
  });
});
