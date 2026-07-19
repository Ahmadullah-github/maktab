import { describe, expect, it } from 'vitest';
import type { ProjectionRequirementView } from '@/features/assignments/projections';
import type { Subject } from '@/features/subjects/types';
import {
  buildTeacherAssignmentBatchChanges,
  buildTeacherSubjectOpportunities,
  matchesTeacherSubjectOpportunity,
} from './teacherAssignmentOpportunities';

const subjects = [
  { id: 10, name: 'Mathematics', code: 'MATH', isDeleted: false },
  { id: 20, name: 'English', code: 'ENG', isDeleted: false },
  { id: 30, name: 'History', code: 'HIS', isDeleted: false },
  { id: 40, name: 'Art', code: 'ART', isDeleted: false },
] as Subject[];

function requirement(
  overrides: Partial<ProjectionRequirementView> &
    Pick<ProjectionRequirementView, 'requirementId' | 'classId' | 'className' | 'subjectId'>
): ProjectionRequirementView {
  return {
    assignmentVersion: 2,
    subjectName: 'Subject',
    requiredPeriodsPerWeek: 5,
    assignedPeriodsPerWeek: 0,
    remainingPeriodsPerWeek: 5,
    allowSplitAssignment: true,
    assignments: [],
    warnings: [],
    ...overrides,
  };
}

describe('teacher assignment opportunities', () => {
  it('prioritizes gaps, keeps current work, and hides completed/no-demand subjects', () => {
    const opportunities = buildTeacherSubjectOpportunities(
      subjects,
      [
        requirement({
          requirementId: 1,
          classId: 1,
          className: '7-A',
          subjectId: 10,
          periodMode: 'class_override',
        }),
        requirement({
          requirementId: 2,
          classId: 2,
          className: '7-B',
          subjectId: 20,
          assignedPeriodsPerWeek: 5,
          remainingPeriodsPerWeek: 0,
          assignments: [{
            assignmentId: 2,
            teacherId: 99,
            teacherName: 'Selected',
            assignedPeriodsPerWeek: 5,
            isFixed: true,
            source: 'manual',
            capabilityLevel: 'primary',
          }],
        }),
        requirement({
          requirementId: 3,
          classId: 3,
          className: '8-A',
          subjectId: 30,
          assignedPeriodsPerWeek: 5,
          remainingPeriodsPerWeek: 0,
          assignments: [{
            assignmentId: 3,
            teacherId: 77,
            teacherName: 'Other',
            assignedPeriodsPerWeek: 5,
            isFixed: true,
            source: 'manual',
            capabilityLevel: 'primary',
          }],
        }),
      ],
      99
    );

    expect(opportunities.map(({ subject, group }) => [subject.id, group])).toEqual([
      [10, 'needs'],
      [20, 'current'],
      [30, 'hidden'],
      [40, 'no_demand'],
    ]);
    expect(matchesTeacherSubjectOpportunity(opportunities[0], '7-a')).toBe(true);
    expect(matchesTeacherSubjectOpportunity(opportunities[2], 'history')).toBe(true);
    expect(opportunities[0].requirements[0].periodMode).toBe('class_override');
  });

  it('preserves partial allocations and completely replaces override allocations', () => {
    const partial = requirement({
      requirementId: 4,
      classId: 4,
      className: '9-A',
      subjectId: 10,
      assignedPeriodsPerWeek: 2,
      remainingPeriodsPerWeek: 3,
      assignments: [{
        assignmentId: 4,
        teacherId: 77,
        teacherName: 'Other',
        assignedPeriodsPerWeek: 2,
        isFixed: true,
        source: 'manual',
        capabilityLevel: 'primary',
      }],
    });
    const full = requirement({
      requirementId: 5,
      classId: 5,
      className: '9-B',
      subjectId: 10,
      assignedPeriodsPerWeek: 5,
      remainingPeriodsPerWeek: 0,
      assignments: [{
        assignmentId: 5,
        teacherId: 77,
        teacherName: 'Other',
        assignedPeriodsPerWeek: 5,
        isFixed: true,
        source: 'manual',
        capabilityLevel: 'primary',
      }],
    });
    const [subjectOpportunity] = buildTeacherSubjectOpportunities(
      [subjects[0]],
      [partial, full],
      99
    );
    const changes = buildTeacherAssignmentBatchChanges(
      subjectOpportunity.requirements,
      99,
      { 4: 3 }
    );

    expect(changes[0].allocations).toEqual([
      { teacherId: 77, periodsPerWeek: 2 },
      { teacherId: 99, periodsPerWeek: 3 },
    ]);
    expect(changes[1].allocations).toEqual([{ teacherId: 99, periodsPerWeek: 5 }]);
  });
});
