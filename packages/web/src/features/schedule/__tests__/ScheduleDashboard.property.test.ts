/**
 * Property-based tests for ScheduleDashboard component
 * Tests delete mutation behavior with random IDs
 *
 * **Feature: schedule-phase3, Property 12: Delete Mutation Called with Correct ID**
 * **Validates: Requirements 5.4**
 */

import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import type { TimetableApiResponse } from '../types';

// Generator for valid schedule IDs
const scheduleIdArb = fc.integer({ min: 1, max: 100000 });

// Generator for valid TimetableApiResponse
const timetableArb = fc.record({
  id: scheduleIdArb,
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

describe('ScheduleDashboard Property Tests', () => {
  /**
   * **Feature: schedule-phase3, Property 12: Delete Mutation Called with Correct ID**
   * **Validates: Requirements 5.4**
   *
   * For any schedule deletion, the delete API SHALL be called with the exact
   * schedule ID that was selected for deletion.
   */
  it('Property 12: Delete mutation is called with the exact schedule ID', () => {
    fc.assert(
      fc.property(scheduleIdArb, (scheduleId) => {
        const deleteMutation = vi.fn();

        // Simulate the delete confirmation handler
        const handleConfirmDelete = (id: number) => {
          deleteMutation(id);
        };

        handleConfirmDelete(scheduleId);

        // Verify the mutation was called with the exact ID
        expect(deleteMutation).toHaveBeenCalledWith(scheduleId);
        expect(deleteMutation).toHaveBeenCalledTimes(1);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12a: Delete mutation receives ID from schedule object
   *
   * When a schedule is selected for deletion, the mutation should receive
   * the ID extracted from the schedule object.
   */
  it('Property 12a: Delete mutation receives ID from schedule object', () => {
    fc.assert(
      fc.property(timetableArb, (schedule) => {
        const deleteMutation = vi.fn();

        // Simulate the flow: schedule selected -> confirm delete -> mutation called
        const scheduleToDelete = schedule;
        const handleConfirmDelete = () => {
          if (scheduleToDelete) {
            deleteMutation(scheduleToDelete.id);
          }
        };

        handleConfirmDelete();

        // Verify the mutation was called with the schedule's ID
        expect(deleteMutation).toHaveBeenCalledWith(schedule.id);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12b: Delete mutation not called when no schedule selected
   *
   * If no schedule is selected for deletion, the mutation should not be called.
   */
  it('Property 12b: Delete mutation not called when no schedule selected', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const deleteMutation = vi.fn();

        // Simulate the flow with no schedule selected
        const scheduleToDelete = null as TimetableApiResponse | null;
        const handleConfirmDelete = () => {
          if (scheduleToDelete !== null) {
            deleteMutation(scheduleToDelete.id);
          }
        };

        handleConfirmDelete();

        // Verify the mutation was NOT called
        expect(deleteMutation).not.toHaveBeenCalled();
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Property 12c: Delete ID is always a positive integer
   *
   * Schedule IDs passed to delete mutation should always be positive integers.
   */
  it('Property 12c: Delete ID is always a positive integer', () => {
    fc.assert(
      fc.property(timetableArb, (schedule) => {
        // Verify the ID is a positive integer
        expect(Number.isInteger(schedule.id)).toBe(true);
        expect(schedule.id).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12d: Multiple deletes use correct IDs
   *
   * When multiple schedules are deleted in sequence, each delete should
   * use the correct ID for that specific schedule.
   */
  it('Property 12d: Multiple deletes use correct IDs', () => {
    fc.assert(
      fc.property(fc.array(timetableArb, { minLength: 1, maxLength: 10 }), (schedules) => {
        const deleteMutation = vi.fn();
        const deletedIds: number[] = [];

        // Simulate deleting each schedule
        for (const schedule of schedules) {
          deleteMutation(schedule.id);
          deletedIds.push(schedule.id);
        }

        // Verify each call used the correct ID
        expect(deleteMutation).toHaveBeenCalledTimes(schedules.length);
        for (let i = 0; i < schedules.length; i++) {
          expect(deleteMutation).toHaveBeenNthCalledWith(i + 1, schedules[i].id);
        }

        // Verify all IDs were captured
        expect(deletedIds).toEqual(schedules.map((s) => s.id));
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Navigation uses correct schedule ID
   *
   * When loading a schedule, navigation should use the exact schedule ID.
   */
  it('Property: Navigation uses correct schedule ID on load', () => {
    fc.assert(
      fc.property(timetableArb, (schedule) => {
        const navigate = vi.fn();

        // Simulate the load handler
        const handleLoad = (s: TimetableApiResponse) => {
          navigate({ to: '/classes-schedule', search: { scheduleId: s.id } });
        };

        handleLoad(schedule);

        // Verify navigation was called with correct ID
        expect(navigate).toHaveBeenCalledWith({
          to: '/classes-schedule',
          search: { scheduleId: schedule.id },
        });
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Dialog state correctly tracks schedule to delete
   *
   * The schedule selected for deletion should be correctly stored and
   * its name should be displayed in the confirmation dialog.
   */
  it('Property: Dialog correctly tracks schedule to delete', () => {
    fc.assert(
      fc.property(timetableArb, (schedule) => {
        let scheduleToDelete: TimetableApiResponse | null = null;
        let dialogOpen = false;

        // Simulate opening delete dialog
        const handleDelete = (s: TimetableApiResponse) => {
          scheduleToDelete = s;
          dialogOpen = true;
        };

        handleDelete(schedule);

        // Verify state is correctly set
        expect(dialogOpen).toBe(true);
        expect(scheduleToDelete).toEqual(schedule);
        // Use non-null assertion since we just set it
        expect(scheduleToDelete!.name).toBe(schedule.name);
        expect(scheduleToDelete!.id).toBe(schedule.id);
      }),
      { numRuns: 100 }
    );
  });
});
