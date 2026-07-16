import { describe, expect, it } from 'vitest';

import { subjectSchema } from '@/schemas/subject.schema';
import { buildOptimisticAssignments } from '../assignments/hooks/useAssignmentMutations';
import type { TeacherClassSubjectAssignment } from '../teacher-assignments';
import { getVisibleSelectionState, toggleVisibleSelection } from './utils/selection';

function assignment(
  id: number,
  teacherId: number,
  classId = 10,
  subjectId = 20
): TeacherClassSubjectAssignment {
  return {
    id,
    teacherId,
    classId,
    subjectId,
    periodsPerWeek: 2,
    isFixed: true,
    schoolId: null,
    isDeleted: false,
    deletedAt: null,
    createdAt: '',
    updatedAt: '',
  };
}

describe('subject client contracts', () => {
  it('uses one nullable, period, and feature contract for create and edit', () => {
    const parsed = subjectSchema.parse({
      name: '  Science  ',
      code: ' SCI ',
      grade: null,
      periodsPerWeek: 84,
      section: '',
      requiredRoomType: null,
      requiredFeatures: [' Projector ', 'projector', 'AUDIO'],
      desiredFeatures: [' WhiteBoard '],
      isDifficult: false,
      minRoomCapacity: 0,
    });

    expect(parsed.name).toBe('Science');
    expect(parsed.code).toBe('SCI');
    expect(parsed.requiredFeatures).toEqual(['projector', 'audio']);
    expect(parsed.desiredFeatures).toEqual(['whiteboard']);
    expect(subjectSchema.safeParse({ ...parsed, periodsPerWeek: 85 }).success).toBe(false);
    expect(subjectSchema.safeParse({ ...parsed, periodsPerWeek: 0 }).success).toBe(false);
  });

  it('keeps hidden selections and computes visible indeterminate state', () => {
    const selected = new Set([1, 99]);
    expect(getVisibleSelectionState(selected, [1, 2, 3])).toEqual({
      allSelected: false,
      someSelected: true,
      selectedCount: 1,
    });

    const allVisible = toggleVisibleSelection(selected, [1, 2, 3]);
    expect([...allVisible].sort((left, right) => left - right)).toEqual([1, 2, 3, 99]);
    expect([...toggleVisibleSelection(allVisible, [1, 2, 3])]).toEqual([99]);
  });

  it('optimistically adds or replaces only the target teacher assignment', () => {
    const previous = [assignment(1, 100), assignment(2, 200)];
    const added = buildOptimisticAssignments(
      previous,
      { teacherId: 300, subjectId: 20, classIds: [10] },
      new Map([[10, 1]])
    );
    expect(added.map((item) => item.teacherId).sort()).toEqual([100, 200, 300]);

    const replaced = buildOptimisticAssignments(
      previous,
      { teacherId: 100, subjectId: 20, classIds: [10] },
      new Map([[10, 3]])
    );
    expect(replaced.filter((item) => item.teacherId === 100)).toHaveLength(1);
    expect(replaced.find((item) => item.teacherId === 100)?.periodsPerWeek).toBe(3);
    expect(replaced.some((item) => item.teacherId === 200)).toBe(true);
  });
});
