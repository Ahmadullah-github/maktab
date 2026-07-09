import { describe, expect, it } from 'vitest';
import { createTeacherSchema, updateTeacherSchema } from '../teacher.schema';

describe('teacher.schema', () => {
  it('normalizes structured fields from plain arrays and objects', () => {
    const parsed = createTeacherSchema.parse({
      fullName: 'Teacher One',
      primarySubjectIds: [3, 6],
      allowedSubjectIds: [],
      availability: { Saturday: [1, 2] },
      unavailable: [],
      preferredRoomIds: [1],
      preferredColleagues: [2],
      classAssignments: [{ subjectId: 3, classIds: [1, '2'] }],
      meta: { imported: true },
    });

    expect(parsed.primarySubjectIds).toEqual([3, 6]);
    expect(parsed.allowedSubjectIds).toEqual([]);
    expect(parsed.availability).toEqual({ Saturday: [1, 2] });
    expect(parsed.preferredRoomIds).toEqual([1]);
    expect(parsed.preferredColleagues).toEqual([2]);
    expect(parsed.classAssignments).toEqual([{ subjectId: '3', classIds: ['1', '2'] }]);
    expect(parsed.meta).toEqual({ imported: true });
  });

  it('normalizes structured fields from JSON strings without double-encoding them', () => {
    const parsed = updateTeacherSchema.parse({
      primarySubjectIds: '[3,6]',
      allowedSubjectIds: '[]',
      availability: '{"Saturday":[1,2]}',
      unavailable: '[]',
      preferredRoomIds: '[4]',
      preferredColleagues: '[5]',
      classAssignments: '[{"subjectId":"3","classIds":["1","2"]}]',
      meta: '{"source":"legacy"}',
    });

    expect(parsed.primarySubjectIds).toEqual([3, 6]);
    expect(parsed.allowedSubjectIds).toEqual([]);
    expect(parsed.availability).toEqual({ Saturday: [1, 2] });
    expect(parsed.unavailable).toEqual([]);
    expect(parsed.preferredRoomIds).toEqual([4]);
    expect(parsed.preferredColleagues).toEqual([5]);
    expect(parsed.classAssignments).toEqual([{ subjectId: '3', classIds: ['1', '2'] }]);
    expect(parsed.meta).toEqual({ source: 'legacy' });
  });
});
