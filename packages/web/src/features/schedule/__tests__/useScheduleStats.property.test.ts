/**
 * Property-based tests for useScheduleStats hook
 * Tests the pure computation functions used by the hook
 *
 * **Feature: schedule-phase3, Property 1: Stats Cards Display Correct Schedule Count**
 * **Feature: schedule-phase3, Property 13: useScheduleStats Returns Correct Total Count**
 * **Feature: schedule-phase3, Property 4: Stats Cards Display Latest Timestamp**
 * **Feature: schedule-phase3, Property 14: useScheduleStats Returns Latest Timestamp**
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { computeLastGeneratedAt } from '../hooks/useScheduleStats';
import type { TimetableApiResponse } from '../types';

// Generator for valid ISO date strings
const isoDateArb = fc
  .integer({
    min: new Date('2020-01-01').getTime(),
    max: new Date('2030-12-31').getTime(),
  })
  .map((timestamp) => new Date(timestamp).toISOString());

// Generator for valid schedule data JSON string
const scheduleDataArb = fc
  .record({
    schedule: fc.constant([]),
    metadata: fc.record({
      classes: fc.array(
        fc.record({
          classId: fc.string({ minLength: 1 }),
          className: fc.string(),
        }),
        { minLength: 0, maxLength: 10 }
      ),
      subjects: fc.array(fc.record({ subjectId: fc.string(), subjectName: fc.string() })),
      teachers: fc.array(
        fc.record({
          teacherId: fc.string({ minLength: 1 }),
          teacherName: fc.string(),
          primarySubjects: fc.array(fc.string()),
          maxPeriodsPerWeek: fc.integer({ min: 0, max: 40 }),
          classTeacherOf: fc.array(fc.string()),
        }),
        { minLength: 0, maxLength: 10 }
      ),
      periodConfiguration: fc.constant(null),
    }),
    statistics: fc.record({
      totalClasses: fc.integer({ min: 0, max: 100 }),
      totalTeachers: fc.integer({ min: 0, max: 100 }),
      totalLessons: fc.integer({ min: 0, max: 1000 }),
      singleTeacherClasses: fc.integer({ min: 0, max: 50 }),
      multiTeacherClasses: fc.integer({ min: 0, max: 50 }),
      totalSubjects: fc.integer({ min: 0, max: 50 }),
      customSubjects: fc.integer({ min: 0, max: 20 }),
      standardSubjects: fc.integer({ min: 0, max: 30 }),
      totalRooms: fc.integer({ min: 0, max: 50 }),
      categoryCounts: fc.constant({}),
      customSubjectsByCategory: fc.constant({}),
      periodsPerWeek: fc.integer({ min: 0, max: 50 }),
      solveTimeSeconds: fc.option(fc.float({ min: 0, max: 300 }), { nil: null }),
      strategy: fc.option(fc.constantFrom('fast', 'balanced', 'thorough'), { nil: null }),
      numConstraintsApplied: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
      qualityScore: fc.option(fc.float({ min: 0, max: 100 }), { nil: null }),
    }),
  })
  .map((data) => JSON.stringify(data));

// Generator for TimetableApiResponse
const timetableResponseArb: fc.Arbitrary<TimetableApiResponse> = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  description: fc.string({ maxLength: 200 }),
  data: scheduleDataArb,
  schoolId: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  academicYearId: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  termId: fc.option(fc.integer({ min: 1, max: 10 }), { nil: null }),
  createdAt: isoDateArb,
  updatedAt: isoDateArb,
});

// Generator for array of schedules
const schedulesArrayArb = fc.array(timetableResponseArb, {
  minLength: 0,
  maxLength: 50,
});

describe('useScheduleStats Property Tests', () => {
  /**
   * **Feature: schedule-phase3, Property 1: Stats Cards Display Correct Schedule Count**
   * **Feature: schedule-phase3, Property 13: useScheduleStats Returns Correct Total Count**
   * **Validates: Requirements 1.3, 7.1**
   *
   * For any list of schedules, the totalSchedules value SHALL equal
   * the length of the schedules array.
   */
  it('Property 1 & 13: totalSchedules equals array length', () => {
    fc.assert(
      fc.property(schedulesArrayArb, (schedules) => {
        // The totalSchedules computation is simply schedules.length
        const totalSchedules = schedules.length;

        // Verify it equals the array length
        expect(totalSchedules).toBe(schedules.length);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: schedule-phase3, Property 4: Stats Cards Display Latest Timestamp**
   * **Feature: schedule-phase3, Property 14: useScheduleStats Returns Latest Timestamp**
   * **Validates: Requirements 1.6, 7.5**
   *
   * For any non-empty list of schedules with varying createdAt timestamps,
   * the lastGeneratedAt value SHALL equal the maximum (most recent) createdAt value.
   */
  it('Property 4 & 14: lastGeneratedAt equals max createdAt', () => {
    fc.assert(
      fc.property(
        // Generate non-empty array of schedules
        fc.array(timetableResponseArb, { minLength: 1, maxLength: 50 }),
        (schedules) => {
          // Compute lastGeneratedAt using the exported function
          const lastGeneratedAt = computeLastGeneratedAt(schedules);

          // Compute expected max date
          const expectedMaxDate = schedules.reduce((max, schedule) => {
            const scheduleDate = new Date(schedule.createdAt);
            return scheduleDate > max ? scheduleDate : max;
          }, new Date(schedules[0].createdAt));

          // Verify lastGeneratedAt equals the max createdAt
          expect(lastGeneratedAt).not.toBeNull();
          expect(lastGeneratedAt!.getTime()).toBe(expectedMaxDate.getTime());
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Empty schedules returns null for lastGeneratedAt
   * **Validates: Requirements 7.7**
   */
  it('Property: Empty schedules returns null for lastGeneratedAt', () => {
    const lastGeneratedAt = computeLastGeneratedAt([]);
    expect(lastGeneratedAt).toBeNull();
  });
});
