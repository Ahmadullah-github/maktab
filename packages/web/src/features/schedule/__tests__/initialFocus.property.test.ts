/**
 * Property-based tests for Initial Focus Behavior
 * **Feature: schedule-phase6, Property 8: Initial Focus Behavior**
 * **Validates: Requirements 6.2**
 *
 * For any grid focus event where focusedSlot is null, the focusedSlot
 * should be set to the first cell (first day, period 0).
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { DayOfWeek, type FocusedSlot } from '../types';
import { getFirstSlot } from '../utils/navigationUtils';

// Days used in the grid (Afghan week: Saturday to Thursday, excluding Friday)
const GRID_DAYS: DayOfWeek[] = [
  DayOfWeek.Saturday,
  DayOfWeek.Sunday,
  DayOfWeek.Monday,
  DayOfWeek.Tuesday,
  DayOfWeek.Wednesday,
  DayOfWeek.Thursday,
];

// Generator for valid DayOfWeek (only days in the grid)
const dayOfWeekArb = fc.constantFrom(...GRID_DAYS);

// Max periods in the grid
const MAX_PERIODS = 8;

// Generator for valid FocusedSlot (constrained to grid bounds)
const focusedSlotArb = fc.record({
  day: dayOfWeekArb,
  period: fc.integer({ min: 0, max: MAX_PERIODS - 1 }),
});

// Generator for non-empty days array
const daysArrayArb = fc
  .shuffledSubarray(GRID_DAYS, { minLength: 1, maxLength: GRID_DAYS.length })
  .map((days) => {
    // Sort to maintain consistent order (Saturday first)
    return days.sort((a, b) => GRID_DAYS.indexOf(a) - GRID_DAYS.indexOf(b));
  });

/**
 * Simulates the initial focus behavior when grid receives focus
 * This is the logic implemented in ScheduleGrid's handleGridFocus
 */
function computeInitialFocus(
  currentFocusedSlot: FocusedSlot | null,
  days: DayOfWeek[]
): FocusedSlot | null {
  // If already focused, don't change
  if (currentFocusedSlot !== null) {
    return currentFocusedSlot;
  }

  // Set to first slot
  return getFirstSlot(days);
}

describe('Initial Focus Property Tests', () => {
  /**
   * **Feature: schedule-phase6, Property 8: Initial Focus Behavior**
   * **Validates: Requirements 6.2**
   *
   * WHEN the grid container receives focus THEN the Schedule_Grid SHALL set
   * the Focused_Slot to the first cell if no slot was previously focused.
   */
  describe('Property 8: Initial Focus Behavior', () => {
    it('sets focusedSlot to first cell when focusedSlot is null', () => {
      fc.assert(
        fc.property(daysArrayArb, (days) => {
          // When focusedSlot is null and grid receives focus
          const result = computeInitialFocus(null, days);

          // Should set to first cell (first day, period 0)
          expect(result).not.toBeNull();
          expect(result!.day).toBe(days[0]);
          expect(result!.period).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it('does not change focusedSlot when already focused', () => {
      fc.assert(
        fc.property(daysArrayArb, focusedSlotArb, (days, existingSlot) => {
          // When focusedSlot is already set and grid receives focus
          const result = computeInitialFocus(existingSlot, days);

          // Should not change the existing focus
          expect(result).toEqual(existingSlot);
        }),
        { numRuns: 100 }
      );
    });

    it('first slot is always day[0] with period 0', () => {
      fc.assert(
        fc.property(daysArrayArb, (days) => {
          const firstSlot = getFirstSlot(days);

          // First slot should always be the first day at period 0
          expect(firstSlot).not.toBeNull();
          expect(firstSlot!.day).toBe(days[0]);
          expect(firstSlot!.period).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it('returns null for empty days array', () => {
      // Edge case: empty days array
      const result = getFirstSlot([]);
      expect(result).toBeNull();
    });

    it('initial focus is idempotent when already focused', () => {
      fc.assert(
        fc.property(daysArrayArb, focusedSlotArb, (days, existingSlot) => {
          // Apply initial focus logic multiple times
          const result1 = computeInitialFocus(existingSlot, days);
          const result2 = computeInitialFocus(result1, days);
          const result3 = computeInitialFocus(result2, days);

          // All results should be the same (idempotent)
          expect(result1).toEqual(existingSlot);
          expect(result2).toEqual(existingSlot);
          expect(result3).toEqual(existingSlot);
        }),
        { numRuns: 100 }
      );
    });

    it('initial focus from null is consistent', () => {
      fc.assert(
        fc.property(daysArrayArb, (days) => {
          // Apply initial focus logic from null multiple times
          const result1 = computeInitialFocus(null, days);
          const result2 = computeInitialFocus(null, days);

          // Both should produce the same first slot
          expect(result1).toEqual(result2);
          expect(result1).not.toBeNull();
          expect(result1!.day).toBe(days[0]);
          expect(result1!.period).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it('initial focus respects different day orderings', () => {
      // Test with different starting days
      const testCases = [
        [DayOfWeek.Saturday, DayOfWeek.Sunday, DayOfWeek.Monday],
        [DayOfWeek.Sunday, DayOfWeek.Monday, DayOfWeek.Tuesday],
        [DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday],
        [DayOfWeek.Thursday], // Single day
      ];

      for (const days of testCases) {
        const result = computeInitialFocus(null, days);
        expect(result).not.toBeNull();
        expect(result!.day).toBe(days[0]);
        expect(result!.period).toBe(0);
      }
    });
  });
});
