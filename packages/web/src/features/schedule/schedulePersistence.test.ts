import { describe, expect, it } from 'vitest';
import type { TimetableApiResponse } from './types';
import {
  normalizeSchedule,
  ScheduleTransformError,
  serializeSchedule,
} from './utils/scheduleTransformer';

const response: TimetableApiResponse = {
  id: 1,
  revision: 1,
  name: 'Test',
  description: '',
  schoolId: null,
  academicYearId: null,
  termId: null,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  data: {
    schedule: [
      {
        day: 'Saturday',
        periodIndex: 0,
        classId: '1',
        subjectId: '2',
        teacherIds: ['3'],
      },
    ],
    metadata: {
      classes: [],
      subjects: [
        { subjectId: '2', subjectName: 'Math', requiredRoomType: 'lab', isDifficult: true },
      ],
      teachers: [
        { teacherId: '3', teacherName: 'Teacher', unavailable: [{ day: 'Saturday', periods: [1] }] },
      ],
    },
  },
};

describe('schedule persistence contract', () => {
  it('round-trips constraint metadata used by manual editing', () => {
    const normalized = normalizeSchedule(response);
    const serialized = JSON.parse(serializeSchedule(normalized));
    expect(serialized.metadata.subjects[0]).toMatchObject({
      requiredRoomType: 'lab',
      isDifficult: true,
    });
    expect(serialized.metadata.teachers[0].unavailable).toEqual([
      { day: 'Saturday', period: 1 },
    ]);
  });

  it('rejects a payload with no schedule array', () => {
    expect(() => normalizeSchedule({ ...response, data: { metadata: {} } })).toThrow(
      ScheduleTransformError
    );
  });

  it('rejects invalid period indices instead of coercing them', () => {
    const data = response.data as { schedule: Array<Record<string, unknown>> };
    expect(() =>
      normalizeSchedule({
        ...response,
        data: { ...data, schedule: [{ ...data.schedule[0], periodIndex: 0.5 }] },
      })
    ).toThrow(/periodIndex/);
  });

  it('unlocks legacy schedules whose generated lessons were all mislabeled fixed', () => {
    const data = response.data as { schedule: Array<Record<string, unknown>>; metadata: object };
    const normalized = normalizeSchedule({
      ...response,
      data: {
        ...data,
        schedule: data.schedule.map((lesson) => ({ ...lesson, isFixed: true })),
      },
    });

    expect(normalized.lessons.every((lesson) => !lesson.isFixed)).toBe(true);
  });

  it('preserves real fixed lessons from fixedness-v2 schedules', () => {
    const data = response.data as { schedule: Array<Record<string, unknown>>; metadata: object };
    const normalized = normalizeSchedule({
      ...response,
      data: {
        ...data,
        schedule: data.schedule.map((lesson) => ({ ...lesson, isFixed: true })),
        metadata: { ...data.metadata, lessonFixednessVersion: 2, fixedLessonCount: 1 },
      },
    });

    expect(normalized.lessons.every((lesson) => lesson.isFixed)).toBe(true);
  });
});
