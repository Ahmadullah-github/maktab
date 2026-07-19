import { describe, expect, it } from 'vitest';

import { subjectSchema } from '@/schemas/subject.schema';
import { buildOptimisticAssignments } from '../assignments/hooks/useAssignmentMutations';
import type { TeacherClassSubjectAssignment } from '../teacher-assignments';
import type { Subject } from './types';
import { getVisibleSelectionState, toggleVisibleSelection } from './utils/selection';
import { calculateSubjectStatistics } from './utils/subjectStatistics';

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

function subject(
  id: number,
  grade: number | null,
  periodsPerWeek: number | null,
  overrides: Partial<Subject> = {}
): Subject {
  return {
    id,
    schoolId: null,
    name: `Subject ${id}`,
    code: `S${id}`,
    grade,
    periodsPerWeek,
    section: grade && grade <= 6 ? 'PRIMARY' : '',
    requiredRoomType: null,
    requiredFeatures: [],
    desiredFeatures: [],
    isDifficult: false,
    minRoomCapacity: 0,
    meta: {},
    isCustom: false,
    customCategory: null,
    isDeleted: false,
    deletedAt: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
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

  it('calculates synchronized grade, selection, quality, and coverage statistics', () => {
    const subjects = [
      subject(1, 1, 5, { isDifficult: true }),
      subject(2, 1, null, { isCustom: true, requiredRoomType: 'science_lab' }),
      subject(3, 2, 3),
      subject(4, null, 2),
    ];
    const coverage = new Map([
      [1, { totalRequiredPeriods: 10, totalAssignedPeriods: 8 }],
      [3, { totalRequiredPeriods: 5, totalAssignedPeriods: 7 }],
    ]);

    const stats = calculateSubjectStatistics(subjects, coverage, [subjects[0], subjects[3]]);

    expect(stats).toMatchObject({
      totalSubjects: 4,
      totalPeriods: 10,
      configuredPeriodCount: 3,
      averagePeriods: 3.3,
      difficultCount: 1,
      specialRoomCount: 1,
      customCount: 1,
      missingGradeCount: 1,
      missingPeriodsCount: 1,
      selectedCount: 2,
      selectedPeriods: 7,
      totalRequiredPeriods: 15,
      totalAssignedPeriods: 15,
      coveredPeriods: 13,
      coveragePercentage: 87,
    });
    expect(stats.byGrade).toEqual([
      expect.objectContaining({
        grade: 1,
        subjectCount: 2,
        totalPeriods: 5,
        configuredSubjectCount: 1,
        averagePeriods: 5,
      }),
      expect.objectContaining({
        grade: 2,
        subjectCount: 1,
        totalPeriods: 3,
        configuredSubjectCount: 1,
        averagePeriods: 3,
      }),
    ]);
    expect(stats.bySection.PRIMARY).toEqual({ subjectCount: 3, totalPeriods: 8 });
  });
});
