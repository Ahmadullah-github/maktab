import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSmartTeacherSelection } from './useSmartTeacherSelection';

const mocks = vi.hoisted(() => ({
  useSubjects: vi.fn(),
  useTeachers: vi.fn(),
  useTeacherWorkloadViews: vi.fn(),
}));

vi.mock('../../subjects/hooks/useSubjects', () => ({ useSubjects: mocks.useSubjects }));
vi.mock('../../teachers/hooks/useTeachers', () => ({ useTeachers: mocks.useTeachers }));
vi.mock('../projections', () => ({
  useTeacherWorkloadViews: mocks.useTeacherWorkloadViews,
}));

describe('useSmartTeacherSelection', () => {
  beforeEach(() => {
    mocks.useSubjects.mockReturnValue({
      data: [
        { id: 10, name: 'Mathematics' },
        { id: 20, name: 'Physics' },
      ],
      isLoading: false,
      error: null,
    });
    mocks.useTeachers.mockReturnValue({
      data: [
        { id: 1, fullName: 'Primary Teacher', isDeleted: false, unavailable: [], maxPeriodsPerWeek: 30 },
        { id: 2, fullName: 'Other Subject Teacher', isDeleted: false, unavailable: [], maxPeriodsPerWeek: 30 },
        { id: 3, fullName: 'Generalist Teacher', isDeleted: false, unavailable: [], maxPeriodsPerWeek: 30 },
        { id: 4, fullName: 'Deleted Teacher', isDeleted: true, unavailable: [], maxPeriodsPerWeek: 30 },
      ],
      isLoading: false,
      error: null,
    });
    mocks.useTeacherWorkloadViews.mockReturnValue({
      workloadByTeacherId: new Map([
        [1, {
          capabilities: [{ subjectId: 10, capabilityLevel: 'primary' }],
          assignments: [],
          assignedPeriodsPerWeek: 0,
          maxPeriodsPerWeek: 30,
          remainingCapacityPerWeek: 30,
        }],
        [2, {
          capabilities: [{ subjectId: 20, capabilityLevel: 'allowed' }],
          assignments: [],
          assignedPeriodsPerWeek: 0,
          maxPeriodsPerWeek: 30,
          remainingCapacityPerWeek: 30,
        }],
        [3, {
          capabilities: [],
          assignments: [],
          assignedPeriodsPerWeek: 0,
          maxPeriodsPerWeek: 30,
          remainingCapacityPerWeek: 30,
        }],
      ]),
      isLoading: false,
      error: null,
    });
  });

  it('returns every active teacher even without an explicit capability for the subject', () => {
    const { result } = renderHook(() =>
      useSmartTeacherSelection({ subjectId: 10, includeOverloaded: true })
    );

    expect(result.current.teachers.map((teacher) => teacher.teacherId)).toEqual([1, 3, 2]);
    expect(result.current.teachers.map((teacher) => teacher.compatibility)).toEqual([
      'primary',
      'generalist',
      'available',
    ]);
    expect(
      result.current.teachers.map((teacher) => teacher.requiresPrimaryAuthorization)
    ).toEqual([false, true, true]);
  });

  it('requires primary authorization when any subject in a bulk assignment is not primary', () => {
    const { result } = renderHook(() =>
      useSmartTeacherSelection({
        subjectId: 10,
        authorizationSubjectIds: [10, 20],
        includeOverloaded: true,
      })
    );

    expect(
      result.current.teachers.map((teacher) => teacher.requiresPrimaryAuthorization)
    ).toEqual([true, true, true]);
  });
});
