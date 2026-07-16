import { describe, expect, it } from 'vitest';
import { addAllocation } from './components/AssignmentDrawerV2';
import { calculateClassOverallStatus } from './hooks/useAssignmentsPage';
import type { ProjectionRequirementView } from './projections';

describe('assignment view model', () => {
  it('keeps a class partial when any requirement is only partly covered', () => {
    expect(calculateClassOverallStatus({
      total: 2,
      assigned: 1,
      partial: 1,
      unassigned: 0,
      conflict: 0,
    })).toBe('partial');
  });

  it('adds split periods to an existing allocation without duplicating the teacher', () => {
    const requirement = {
      assignments: [{
        assignmentId: 1,
        teacherId: 7,
        teacherName: 'Teacher',
        assignedPeriodsPerWeek: 2,
        isFixed: true,
        source: 'manual',
        capabilityLevel: 'primary',
      }],
    } as ProjectionRequirementView;

    expect(addAllocation(requirement, 7, 2)).toEqual([
      { teacherId: 7, periodsPerWeek: 4 },
    ]);
    expect(addAllocation(requirement, 8, 1)).toEqual([
      { teacherId: 7, periodsPerWeek: 2 },
      { teacherId: 8, periodsPerWeek: 1 },
    ]);
  });
});
