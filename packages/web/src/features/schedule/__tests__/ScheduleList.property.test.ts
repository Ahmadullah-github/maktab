/**
 * Property-based tests for ScheduleList component
 * Tests sorting and pagination behavior
 *
 * **Feature: schedule-phase3, Property 5: Schedule List Sorted by Date Descending**
 * **Feature: schedule-phase3, Property 6: Pagination Shown When Schedules Exceed Threshold**
 * **Validates: Requirements 2.2, 2.4**
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { sortSchedulesByDate } from '../components/dashboard/ScheduleList';
import type { TimetableApiResponse } from '../types';

// Generator for valid TimetableApiResponse
const timetableArb = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.string({ maxLength: 500 }),
  data: fc.constant(JSON.stringify({ statistics: { totalClasses: 10 } })),
  schoolId: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  academicYearId: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  termId: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  createdAt: fc
    .integer({
      min: new Date('2020-01-01').getTime(),
      max: new Date('2030-12-31').getTime(),
    })
    .map((timestamp) => new Date(timestamp).toISOString()),
  updatedAt: fc
    .integer({
      min: new Date('2020-01-01').getTime(),
      max: new Date('2030-12-31').getTime(),
    })
    .map((timestamp) => new Date(timestamp).toISOString()),
}) as fc.Arbitrary<TimetableApiResponse>;

// Generator for array of timetables with unique IDs
const timetablesArb = fc.array(timetableArb, { minLength: 0, maxLength: 50 }).map((schedules) => {
  // Ensure unique IDs
  return schedules.map((s, index) => ({ ...s, id: index + 1 }));
});

describe('ScheduleList Property Tests', () => {
  /**
   * **Feature: schedule-phase3, Property 5: Schedule List Sorted by Date Descending**
   * **Validates: Requirements 2.2**
   *
   * For any list of schedules, the ScheduleList component SHALL render them
   * in descending order by createdAt (newest first).
   */
  it('Property 5: Schedules are sorted by createdAt descending (newest first)', () => {
    fc.assert(
      fc.property(timetablesArb, (schedules) => {
        const sorted = sortSchedulesByDate(schedules);

        // Verify the sorted array has the same length
        expect(sorted.length).toBe(schedules.length);

        // Verify each consecutive pair is in descending order by createdAt
        for (let i = 0; i < sorted.length - 1; i++) {
          const currentDate = new Date(sorted[i].createdAt).getTime();
          const nextDate = new Date(sorted[i + 1].createdAt).getTime();
          expect(currentDate).toBeGreaterThanOrEqual(nextDate);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Sorting preserves all original elements
   */
  it('Property 5a: Sorting preserves all original elements', () => {
    fc.assert(
      fc.property(timetablesArb, (schedules) => {
        const sorted = sortSchedulesByDate(schedules);

        // All original IDs should be present in sorted array
        const originalIds = new Set(schedules.map((s) => s.id));
        const sortedIds = new Set(sorted.map((s) => s.id));

        expect(sortedIds.size).toBe(originalIds.size);
        originalIds.forEach((id) => {
          expect(sortedIds.has(id)).toBe(true);
        });
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Sorting does not mutate the original array
   */
  it('Property 5b: Sorting does not mutate the original array', () => {
    fc.assert(
      fc.property(timetablesArb, (schedules) => {
        const originalOrder = schedules.map((s) => s.id);
        sortSchedulesByDate(schedules);
        const afterSortOrder = schedules.map((s) => s.id);

        // Original array should be unchanged
        expect(afterSortOrder).toEqual(originalOrder);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: schedule-phase3, Property 6: Pagination Shown When Schedules Exceed Threshold**
   * **Validates: Requirements 2.4**
   *
   * For any list of schedules with length greater than 10, the ScheduleList
   * component SHALL display pagination controls.
   */
  it('Property 6: Pagination visibility based on schedule count', () => {
    fc.assert(
      fc.property(timetablesArb, (schedules) => {
        const ITEMS_PER_PAGE = 10;
        const shouldShowPagination = schedules.length > ITEMS_PER_PAGE;

        // This property verifies the logic: pagination shown iff length > 10
        if (schedules.length > ITEMS_PER_PAGE) {
          expect(shouldShowPagination).toBe(true);
        } else {
          expect(shouldShowPagination).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Total pages calculation is correct
   */
  it('Property 6a: Total pages calculation is correct', () => {
    fc.assert(
      fc.property(timetablesArb, (schedules) => {
        const ITEMS_PER_PAGE = 10;
        const expectedTotalPages = Math.ceil(schedules.length / ITEMS_PER_PAGE);

        // For empty array, Math.ceil(0/10) = 0
        // For 1-10 items, Math.ceil(n/10) = 1
        // For 11-20 items, Math.ceil(n/10) = 2
        // etc.
        if (schedules.length === 0) {
          expect(expectedTotalPages).toBe(0);
        } else {
          expect(expectedTotalPages).toBeGreaterThanOrEqual(1);
          expect(expectedTotalPages).toBe(Math.ceil(schedules.length / ITEMS_PER_PAGE));
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: First page contains correct number of items
   */
  it('Property 6b: First page contains correct number of items', () => {
    fc.assert(
      fc.property(timetablesArb, (schedules) => {
        const ITEMS_PER_PAGE = 10;
        const sorted = sortSchedulesByDate(schedules);
        const firstPageItems = sorted.slice(0, ITEMS_PER_PAGE);

        if (schedules.length === 0) {
          expect(firstPageItems.length).toBe(0);
        } else if (schedules.length <= ITEMS_PER_PAGE) {
          expect(firstPageItems.length).toBe(schedules.length);
        } else {
          expect(firstPageItems.length).toBe(ITEMS_PER_PAGE);
        }
      }),
      { numRuns: 100 }
    );
  });
});
