/**
 * Unit tests for schedule transformer
 * _Requirements: 4.6_
 */

import { describe, expect, it } from 'vitest';

import { DayOfWeek, type TimetableApiResponse } from '../types';
import { normalizeSchedule, ScheduleTransformError } from '../utils/scheduleTransformer';

describe('Schedule Transformer Unit Tests', () => {
  describe('normalizeSchedule', () => {
    it('transforms valid API response correctly', () => {
      const apiResponse: TimetableApiResponse = {
        id: 1,
        name: 'Test Schedule',
        description: 'A test schedule',
        data: JSON.stringify({
          schedule: [
            {
              day: 'Monday',
              periodIndex: 2,
              classId: 'c1',
              className: 'Class 1A',
              subjectId: 's1',
              subjectName: 'Mathematics',
              teacherIds: ['t1', 't2'],
              teacherNames: ['Teacher One', 'Teacher Two'],
              roomId: 'r1',
              roomName: 'Room 101',
              isFixed: false,
              periodsThisDay: 6,
            },
          ],
          metadata: {
            classes: [
              {
                classId: 'c1',
                className: 'Class 1A',
                gradeLevel: 1,
                category: 'ALPHA_PRIMARY',
                categoryDari: 'ابتدایی الف',
                studentCount: 30,
                singleTeacherMode: true,
                classTeacherId: 't1',
                classTeacherName: 'Teacher One',
                classTeacherSubjects: ['s1', 's2'],
              },
            ],
            subjects: [
              {
                subjectId: 's1',
                subjectName: 'Mathematics',
                isCustom: false,
                customCategory: null,
                customCategoryDari: null,
              },
            ],
            teachers: [
              {
                teacherId: 't1',
                teacherName: 'Teacher One',
                primarySubjects: ['s1'],
                maxPeriodsPerWeek: 30,
                classTeacherOf: ['c1'],
              },
            ],
            periodConfiguration: {
              periodsPerDayMap: { Saturday: 6, Sunday: 6, Monday: 6 },
              totalPeriodsPerWeek: 36,
              daysOfWeek: ['Saturday', 'Sunday', 'Monday'],
              hasVariablePeriods: false,
            },
          },
          statistics: {
            totalClasses: 10,
            singleTeacherClasses: 6,
            multiTeacherClasses: 4,
            totalSubjects: 15,
            customSubjects: 3,
            standardSubjects: 12,
            totalTeachers: 20,
            totalRooms: 8,
            categoryCounts: { ALPHA_PRIMARY: 3, BETA_PRIMARY: 3, MIDDLE: 2, HIGH: 2 },
            customSubjectsByCategory: { ALPHA_PRIMARY: 1, MIDDLE: 2 },
            totalLessons: 500,
            periodsPerWeek: 36,
            solveTimeSeconds: 2.5,
            strategy: 'balanced',
            numConstraintsApplied: 45,
            qualityScore: 95.5,
          },
          status: 'SUCCESS',
        }),
        schoolId: null,
        academicYearId: null,
        termId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const result = normalizeSchedule(apiResponse);

      // Check lessons
      expect(result.lessons).toHaveLength(1);
      expect(result.lessons[0].day).toBe(DayOfWeek.Monday);
      expect(result.lessons[0].periodIndex).toBe(2);
      expect(result.lessons[0].classId).toBe('c1');
      expect(result.lessons[0].className).toBe('Class 1A');
      expect(result.lessons[0].subjectId).toBe('s1');
      expect(result.lessons[0].subjectName).toBe('Mathematics');
      expect(result.lessons[0].teacherIds).toEqual(['t1', 't2']);
      expect(result.lessons[0].teacherNames).toEqual(['Teacher One', 'Teacher Two']);
      expect(result.lessons[0].roomId).toBe('r1');
      expect(result.lessons[0].roomName).toBe('Room 101');
      expect(result.lessons[0].isFixed).toBe(false);
      expect(result.lessons[0].periodsThisDay).toBe(6);

      // Check metadata
      expect(result.metadata).not.toBeNull();
      expect(result.metadata!.classes).toHaveLength(1);
      expect(result.metadata!.classes[0].classId).toBe('c1');
      expect(result.metadata!.classes[0].gradeLevel).toBe(1);
      expect(result.metadata!.subjects).toHaveLength(1);
      expect(result.metadata!.teachers).toHaveLength(1);
      expect(result.metadata!.periodConfiguration).not.toBeNull();
      expect(result.metadata!.periodConfiguration!.totalPeriodsPerWeek).toBe(36);

      // Check statistics
      expect(result.statistics).not.toBeNull();
      expect(result.statistics!.totalClasses).toBe(10);
      expect(result.statistics!.totalLessons).toBe(500);
      expect(result.statistics!.solveTimeSeconds).toBe(2.5);
      expect(result.statistics!.strategy).toBe('balanced');
      expect(result.statistics!.qualityScore).toBe(95.5);
    });

    it('throws ScheduleTransformError for malformed JSON', () => {
      const apiResponse: TimetableApiResponse = {
        id: 1,
        name: 'Bad Schedule',
        description: 'Invalid JSON',
        data: 'not valid json {{{',
        schoolId: null,
        academicYearId: null,
        termId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(() => normalizeSchedule(apiResponse)).toThrow(ScheduleTransformError);
      expect(() => normalizeSchedule(apiResponse)).toThrow(/Failed to parse schedule data/);
    });

    it('recovers legacy character-indexed timetable payloads', () => {
      const rawPayload = JSON.stringify({
        schedule: [
          {
            day: 'Saturday',
            periodIndex: 0,
            classId: '10',
            subjectId: '60',
            teacherIds: ['24'],
            isFixed: false,
            periodsThisDay: 6,
          },
        ],
        metadata: {
          classes: [
            {
              classId: '10',
              className: '10A',
              gradeLevel: 10,
              category: 'High',
              categoryDari: 'لیسه',
              studentCount: 32,
              singleTeacherMode: false,
              classTeacherId: null,
              classTeacherName: null,
              classTeacherSubjects: null,
            },
          ],
          subjects: [],
          teachers: [
            {
              teacherId: '24',
              teacherName: 'Teacher 24',
              primarySubjects: ['60'],
              maxPeriodsPerWeek: 24,
              classTeacherOf: [],
            },
          ],
          periodConfiguration: {
            periodsPerDayMap: { Saturday: 6 },
            totalPeriodsPerWeek: 6,
            daysOfWeek: ['Saturday'],
            hasVariablePeriods: false,
          },
        },
        statistics: {
          totalClasses: 1,
          totalLessons: 1,
        },
      });

      const apiResponse: TimetableApiResponse = {
        id: 12,
        name: 'Legacy Schedule',
        description: 'Corrupted by string spread',
        data: Object.assign({}, rawPayload),
        schoolId: null,
        academicYearId: null,
        termId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const result = normalizeSchedule(apiResponse);

      expect(result.lessons).toHaveLength(1);
      expect(result.lessons[0].classId).toBe('10');
      expect(result.lessons[0].teacherIds).toEqual(['24']);
      expect(result.metadata?.classes[0].gradeLevel).toBe(10);
      expect(result.metadata?.periodConfiguration?.daysOfWeek).toEqual(['Saturday']);
      expect(result.statistics?.totalLessons).toBe(1);
    });

    it('handles missing optional fields gracefully', () => {
      const apiResponse: TimetableApiResponse = {
        id: 1,
        name: 'Minimal Schedule',
        description: 'Minimal data',
        data: JSON.stringify({
          schedule: [
            {
              day: 'Saturday',
              periodIndex: 0,
              classId: 'c1',
              subjectId: 's1',
              teacherIds: ['t1'],
              // Missing optional fields: className, subjectName, teacherNames, roomId, roomName, periodsThisDay
            },
          ],
          // Missing metadata and statistics
        }),
        schoolId: null,
        academicYearId: null,
        termId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const result = normalizeSchedule(apiResponse);

      // Check lessons with defaults
      expect(result.lessons).toHaveLength(1);
      expect(result.lessons[0].day).toBe(DayOfWeek.Saturday);
      expect(result.lessons[0].className).toBeNull();
      expect(result.lessons[0].subjectName).toBeNull();
      expect(result.lessons[0].teacherNames).toBeNull();
      expect(result.lessons[0].roomId).toBeNull();
      expect(result.lessons[0].roomName).toBeNull();
      expect(result.lessons[0].isFixed).toBe(false);
      expect(result.lessons[0].periodsThisDay).toBeNull();

      // Metadata and statistics should be null
      expect(result.metadata).toBeNull();
      expect(result.statistics).toBeNull();
    });

    it('handles empty schedule array', () => {
      const apiResponse: TimetableApiResponse = {
        id: 1,
        name: 'Empty Schedule',
        description: 'No lessons',
        data: JSON.stringify({
          schedule: [],
          metadata: {
            classes: [],
            subjects: [],
            teachers: [],
            periodConfiguration: null,
          },
          statistics: {
            totalClasses: 0,
            totalLessons: 0,
          },
        }),
        schoolId: null,
        academicYearId: null,
        termId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const result = normalizeSchedule(apiResponse);

      expect(result.lessons).toHaveLength(0);
      expect(result.metadata).not.toBeNull();
      expect(result.metadata!.classes).toHaveLength(0);
      expect(result.statistics).not.toBeNull();
      expect(result.statistics!.totalLessons).toBe(0);
    });

    it('throws error for invalid day value', () => {
      const apiResponse: TimetableApiResponse = {
        id: 1,
        name: 'Invalid Day',
        description: 'Bad day value',
        data: JSON.stringify({
          schedule: [
            {
              day: 'InvalidDay',
              periodIndex: 0,
              classId: 'c1',
              subjectId: 's1',
              teacherIds: ['t1'],
            },
          ],
        }),
        schoolId: null,
        academicYearId: null,
        termId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(() => normalizeSchedule(apiResponse)).toThrow(ScheduleTransformError);
      expect(() => normalizeSchedule(apiResponse)).toThrow(/Invalid day value/);
    });

    it('throws error for missing required lesson fields', () => {
      const apiResponse: TimetableApiResponse = {
        id: 1,
        name: 'Missing Fields',
        description: 'Missing required fields',
        data: JSON.stringify({
          schedule: [
            {
              day: 'Monday',
              periodIndex: 0,
              // Missing classId and subjectId
            },
          ],
        }),
        schoolId: null,
        academicYearId: null,
        termId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(() => normalizeSchedule(apiResponse)).toThrow(ScheduleTransformError);
      expect(() => normalizeSchedule(apiResponse)).toThrow(/missing classId/);
    });

    it('handles metadata with null periodConfiguration', () => {
      const apiResponse: TimetableApiResponse = {
        id: 1,
        name: 'No Period Config',
        description: 'Missing period configuration',
        data: JSON.stringify({
          schedule: [],
          metadata: {
            classes: [{ classId: 'c1', className: 'Class 1' }],
            subjects: [],
            teachers: [],
            periodConfiguration: null,
          },
        }),
        schoolId: null,
        academicYearId: null,
        termId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const result = normalizeSchedule(apiResponse);

      expect(result.metadata).not.toBeNull();
      expect(result.metadata!.periodConfiguration).toBeNull();
      expect(result.metadata!.classes).toHaveLength(1);
    });

    it('handles statistics with null optional fields', () => {
      const apiResponse: TimetableApiResponse = {
        id: 1,
        name: 'Partial Stats',
        description: 'Some stats missing',
        data: JSON.stringify({
          schedule: [],
          statistics: {
            totalClasses: 5,
            totalLessons: 100,
            // Missing optional fields: solveTimeSeconds, strategy, numConstraintsApplied, qualityScore
          },
        }),
        schoolId: null,
        academicYearId: null,
        termId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const result = normalizeSchedule(apiResponse);

      expect(result.statistics).not.toBeNull();
      expect(result.statistics!.totalClasses).toBe(5);
      expect(result.statistics!.totalLessons).toBe(100);
      expect(result.statistics!.solveTimeSeconds).toBeNull();
      expect(result.statistics!.strategy).toBeNull();
      expect(result.statistics!.numConstraintsApplied).toBeNull();
      expect(result.statistics!.qualityScore).toBeNull();
    });

    it('preserves extended period configuration metadata', () => {
      const apiResponse: TimetableApiResponse = {
        id: 2,
        name: 'Extended Period Metadata',
        description: 'Contains category and break metadata',
        data: JSON.stringify({
          schedule: [],
          metadata: {
            classes: [],
            subjects: [],
            teachers: [],
            periodConfiguration: {
              periodsPerDayMap: {
                Saturday: 8,
                Thursday: 2,
              },
              totalPeriodsPerWeek: 42,
              daysOfWeek: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
              hasVariablePeriods: true,
              categoryPeriodsPerDayMap: {
                'Alpha-Primary': {
                  Saturday: 4,
                  Thursday: 2,
                },
                'Beta-Primary': {
                  Saturday: 6,
                  Thursday: 2,
                },
                Middle: {
                  Saturday: 8,
                  Thursday: 2,
                },
              },
              breakPeriodsDefault: [
                { afterPeriod: 2, duration: 15 },
                { afterPeriod: 4, duration: 20 },
              ],
              breakPeriodsByDay: {
                Thursday: [{ afterPeriod: 1, duration: 10 }],
              },
              hasVariableBreaks: true,
            },
          },
        }),
        schoolId: null,
        academicYearId: null,
        termId: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const result = normalizeSchedule(apiResponse);

      expect(result.metadata?.periodConfiguration?.categoryPeriodsPerDayMap).toEqual({
        'Alpha-Primary': {
          Saturday: 4,
          Thursday: 2,
        },
        'Beta-Primary': {
          Saturday: 6,
          Thursday: 2,
        },
        Middle: {
          Saturday: 8,
          Thursday: 2,
        },
      });
      expect(result.metadata?.periodConfiguration?.breakPeriodsDefault).toEqual([
        { afterPeriod: 2, duration: 15 },
        { afterPeriod: 4, duration: 20 },
      ]);
      expect(result.metadata?.periodConfiguration?.breakPeriodsByDay).toEqual({
        Thursday: [{ afterPeriod: 1, duration: 10 }],
      });
      expect(result.metadata?.periodConfiguration?.hasVariableBreaks).toBe(true);
    });
  });
});
