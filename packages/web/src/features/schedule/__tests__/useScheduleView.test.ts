/**
 * Unit tests for useScheduleView hook
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useScheduleView } from '../hooks/useScheduleView';
import { useScheduleStore } from '../stores/scheduleStore';
import type { ClassMetadata, ScheduledLesson, SolutionMetadata, TeacherMetadata } from '../types';
import { DayOfWeek } from '../types';
import { buildIndexes } from '../utils/indexBuilder';

function createClass(overrides: Partial<ClassMetadata> = {}): ClassMetadata {
  return {
    classId: 'class-1',
    className: 'Class 1A',
    gradeLevel: 1,
    category: 'ALPHA_PRIMARY',
    categoryDari: 'ابتدایی الف',
    studentCount: 25,
    singleTeacherMode: false,
    classTeacherId: null,
    classTeacherName: null,
    classTeacherSubjects: null,
    ...overrides,
  };
}

function createTeacher(overrides: Partial<TeacherMetadata> = {}): TeacherMetadata {
  return {
    teacherId: 'teacher-1',
    teacherName: 'Teacher 1',
    primarySubjects: ['subject-1'],
    maxPeriodsPerWeek: 24,
    classTeacherOf: [],
    ...overrides,
  };
}

function createLesson(overrides: Partial<ScheduledLesson> = {}): ScheduledLesson {
  return {
    day: DayOfWeek.Saturday,
    periodIndex: 0,
    classId: 'class-1',
    className: 'Class 1A',
    subjectId: 'subject-1',
    subjectName: 'Math',
    teacherIds: ['teacher-1'],
    teacherNames: ['Teacher 1'],
    roomId: 'room-1',
    roomName: 'Room 1',
    isFixed: false,
    periodsThisDay: 6,
    ...overrides,
  };
}

function seedScheduleState(
  classes: ClassMetadata[],
  teachers: TeacherMetadata[],
  lessons: ScheduledLesson[],
  metadataOverrides: Partial<SolutionMetadata> = {}
) {
  const baseMetadata: SolutionMetadata = {
    classes,
    teachers,
    subjects: [],
    periodConfiguration: {
      periodsPerDayMap: {
        [DayOfWeek.Saturday]: 6,
        [DayOfWeek.Sunday]: 6,
      },
      totalPeriodsPerWeek: 12,
      daysOfWeek: [DayOfWeek.Saturday, DayOfWeek.Sunday],
      hasVariablePeriods: false,
    },
  };
  const metadata: SolutionMetadata = {
    ...baseMetadata,
    ...metadataOverrides,
    periodConfiguration: metadataOverrides.periodConfiguration
      ? {
          ...baseMetadata.periodConfiguration,
          ...metadataOverrides.periodConfiguration,
        }
      : baseMetadata.periodConfiguration,
  };

  useScheduleStore.setState({
    classes: new Map(classes.map((classMetadata) => [classMetadata.classId, classMetadata])),
    teachers: new Map(teachers.map((teacherMetadata) => [teacherMetadata.teacherId, teacherMetadata])),
    lessons,
    indexes: buildIndexes(lessons),
    metadata,
  });
}

describe('useScheduleView', () => {
  beforeEach(() => {
    useScheduleStore.getState().clearSchedule();
  });

  it('auto-selects the first available class for class view', async () => {
    const classes = [
      createClass({ classId: 'class-10a', className: '10A', gradeLevel: 10, category: 'HIGH' }),
      createClass({ classId: 'class-10b', className: '10B', gradeLevel: 10, category: 'HIGH' }),
    ];
    const teachers = [createTeacher()];
    const lessons = [
      createLesson({ classId: 'class-10a', className: '10A' }),
      createLesson({
        classId: 'class-10b',
        className: '10B',
        periodIndex: 1,
      }),
    ];

    seedScheduleState(classes, teachers, lessons);

    const { result } = renderHook(() => useScheduleView('class'));

    await waitFor(() => {
      expect(result.current.currentViewId).toBe('class-10a');
    });

    expect(result.current.filteredLessons).toEqual([lessons[0]]);
  });

  it('groups classes by metadata category when gradeLevel is missing', async () => {
    const classes = [
      createClass({
        classId: 'class-11a',
        className: '11A',
        gradeLevel: null,
        category: 'HIGH',
      }),
    ];
    const teachers = [createTeacher()];
    const lessons = [createLesson({ classId: 'class-11a', className: '11A' })];

    seedScheduleState(classes, teachers, lessons);

    const { result } = renderHook(() => useScheduleView('class'));

    await waitFor(() => {
      expect(result.current.currentViewId).toBe('class-11a');
    });

    const highCategory = result.current.availableClasses.find((category) => category.key === 'HIGH');
    expect(highCategory?.classes.map((classMetadata) => classMetadata.classId)).toEqual(['class-11a']);
  });

  it('keeps teacher view on the all-teachers selection by default', async () => {
    const classes = [createClass()];
    const teachers = [
      createTeacher({ teacherId: 'teacher-1', teacherName: 'Teacher 1' }),
      createTeacher({ teacherId: 'teacher-2', teacherName: 'Teacher 2' }),
    ];
    const lessons = [
      createLesson({ teacherIds: ['teacher-1'], teacherNames: ['Teacher 1'] }),
      createLesson({
        teacherIds: ['teacher-2'],
        teacherNames: ['Teacher 2'],
        periodIndex: 1,
      }),
    ];

    seedScheduleState(classes, teachers, lessons);

    const { result } = renderHook(() => useScheduleView('teacher'));

    await waitFor(() => {
      expect(result.current.availableTeachers).toHaveLength(2);
    });

    expect(result.current.currentViewId).toBeNull();
    expect(result.current.filteredLessons).toEqual([]);
  });

  it('returns detached teacher metadata snapshots', async () => {
    const classes = [createClass()];
    const teacher = createTeacher({
      classTeacherOf: ['Class 1A'],
      primarySubjects: ['Mathematics', 'Physics'],
      availability: {
        [DayOfWeek.Saturday]: [true, false, true],
      },
    });
    const lessons = [createLesson()];

    seedScheduleState(classes, [teacher], lessons);

    const { result } = renderHook(() => useScheduleView('teacher'));

    await waitFor(() => {
      expect(result.current.availableTeachers).toHaveLength(1);
    });

    const [availableTeacher] = result.current.availableTeachers;

    expect(availableTeacher).not.toBe(teacher);
    expect(availableTeacher.primarySubjects).not.toBe(teacher.primarySubjects);
    expect(availableTeacher.classTeacherOf).not.toBe(teacher.classTeacherOf);
    expect(availableTeacher.availability).not.toBe(teacher.availability);
    expect(availableTeacher.availability?.[DayOfWeek.Saturday]).not.toBe(
      teacher.availability?.[DayOfWeek.Saturday]
    );
  });

  it('keeps teacher metadata readable after merging constraint context', async () => {
    const classes = [createClass()];
    const teachers = [
      createTeacher({
        teacherId: 'teacher-1',
        teacherName: 'Teacher 1',
        primarySubjects: ['Mathematics'],
        classTeacherOf: ['Class 1A'],
      }),
    ];
    const lessons = [createLesson()];

    seedScheduleState(classes, teachers, lessons);

    const { result } = renderHook(() => useScheduleView('teacher'));

    await waitFor(() => {
      expect(result.current.availableTeachers).toHaveLength(1);
    });

    act(() => {
      useScheduleStore.getState().mergeConstraintContext({
        teachers: [
          {
            teacherId: 'teacher-1',
            availability: {
              [DayOfWeek.Saturday]: [true, false, true],
            },
            timePreference: 'Morning',
            maxConsecutivePeriods: 2,
          },
        ],
        subjects: [],
        rooms: [],
      });
    });

    await waitFor(() => {
      expect(result.current.availableTeachers[0].primarySubjects).toEqual(['Mathematics']);
      expect(result.current.availableTeachers[0].classTeacherOf).toEqual(['Class 1A']);
      expect(result.current.availableTeachers[0].availability?.[DayOfWeek.Saturday]).toEqual([
        true,
        false,
        true,
      ]);
      expect(result.current.availableTeachers[0].timePreference).toBe('Morning');
      expect(result.current.availableTeachers[0].maxConsecutivePeriods).toBe(2);
    });
  });

  it('repairs a stale class selection when the available classes change', async () => {
    const initialClasses = [
      createClass({ classId: 'class-7a', className: '7A', gradeLevel: 7, category: 'MIDDLE' }),
      createClass({ classId: 'class-7b', className: '7B', gradeLevel: 7, category: 'MIDDLE' }),
    ];
    const teachers = [createTeacher()];
    const initialLessons = [
      createLesson({ classId: 'class-7a', className: '7A' }),
      createLesson({ classId: 'class-7b', className: '7B', periodIndex: 1 }),
    ];

    seedScheduleState(initialClasses, teachers, initialLessons);

    const { result } = renderHook(() => useScheduleView('class'));

    await waitFor(() => {
      expect(result.current.currentViewId).toBe('class-7a');
    });

    act(() => {
      result.current.setView('class', 'class-7b');
    });

    await waitFor(() => {
      expect(result.current.currentViewId).toBe('class-7b');
    });

    const updatedClasses = [
      createClass({ classId: 'class-8a', className: '8A', gradeLevel: 8, category: 'MIDDLE' }),
    ];
    const updatedLessons = [createLesson({ classId: 'class-8a', className: '8A' })];

    act(() => {
      seedScheduleState(updatedClasses, teachers, updatedLessons);
    });

    await waitFor(() => {
      expect(result.current.currentViewId).toBe('class-8a');
    });
  });

  it('uses category-specific periods for the selected class when metadata provides them', async () => {
    const classes = [
      createClass({
        classId: 'alpha-1',
        className: 'Alpha 1',
        gradeLevel: 1,
        category: 'Alpha-Primary',
      }),
      createClass({
        classId: 'beta-1',
        className: 'Beta 1',
        gradeLevel: 4,
        category: 'Beta-Primary',
      }),
    ];
    const teachers = [createTeacher()];
    const lessons = [
      createLesson({
        classId: 'alpha-1',
        className: 'Alpha 1',
        periodsThisDay: 4,
      }),
      createLesson({
        classId: 'beta-1',
        className: 'Beta 1',
        periodIndex: 1,
        periodsThisDay: 6,
      }),
    ];

    seedScheduleState(classes, teachers, lessons, {
      periodConfiguration: {
        periodsPerDayMap: {
          [DayOfWeek.Saturday]: 8,
          [DayOfWeek.Thursday]: 2,
        },
        totalPeriodsPerWeek: 10,
        daysOfWeek: [DayOfWeek.Saturday, DayOfWeek.Thursday],
        hasVariablePeriods: true,
        categoryPeriodsPerDayMap: {
          'Alpha-Primary': {
            [DayOfWeek.Saturday]: 4,
            [DayOfWeek.Thursday]: 2,
          },
          'Beta-Primary': {
            [DayOfWeek.Saturday]: 6,
            [DayOfWeek.Thursday]: 2,
          },
        },
      },
    });

    const { result } = renderHook(() => useScheduleView('class'));

    await waitFor(() => {
      expect(result.current.currentViewId).toBe('alpha-1');
    });

    expect(result.current.periodsPerDay.get(DayOfWeek.Saturday)).toBe(4);
    expect(result.current.periodsPerDay.get(DayOfWeek.Thursday)).toBe(2);

    act(() => {
      result.current.setView('class', 'beta-1');
    });

    await waitFor(() => {
      expect(result.current.periodsPerDay.get(DayOfWeek.Saturday)).toBe(6);
    });

    expect(result.current.periodsPerDay.get(DayOfWeek.Thursday)).toBe(2);
  });
});
