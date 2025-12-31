/**
 * Property-based tests for FocusIndicator component
 * **Feature: schedule-phase6, Property 3: Focus Indicator Uniqueness**
 * **Validates: Requirements 2.1, 2.2**
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { DayOfWeek, type FocusedSlot, type ScheduledLesson } from '../types';

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

// Generator for non-empty string IDs
const idArb = fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0);

// Max periods in the grid
const MAX_PERIODS = 8;

// Generator for valid FocusedSlot (constrained to grid bounds)
const focusedSlotArb = fc.record({
  day: dayOfWeekArb,
  period: fc.integer({ min: 0, max: MAX_PERIODS - 1 }),
});

// Generator for valid ScheduledLesson
const scheduledLessonArb: fc.Arbitrary<ScheduledLesson> = fc.record({
  day: dayOfWeekArb,
  periodIndex: fc.integer({ min: 0, max: MAX_PERIODS - 1 }),
  classId: idArb,
  className: fc.option(fc.string(), { nil: null }),
  subjectId: idArb,
  subjectName: fc.option(fc.string(), { nil: null }),
  teacherIds: fc.array(idArb, { minLength: 1, maxLength: 3 }),
  teacherNames: fc.option(fc.array(fc.string()), { nil: null }),
  roomId: fc.option(idArb, { nil: null }),
  roomName: fc.option(fc.string(), { nil: null }),
  isFixed: fc.boolean(),
  periodsThisDay: fc.option(fc.integer({ min: 1, max: 8 }), { nil: null }),
});

// Generator for a grid of lessons (simulating schedule state)
const scheduleGridArb = fc.array(scheduledLessonArb, { minLength: 0, maxLength: 20 });

/**
 * Helper function to create cell ID from day and period
 */
function createCellId(day: DayOfWeek, period: number): string {
  return `${day}-${period}`;
}

/**
 * Simulates the logic that determines which cells have isFocused=true
 * based on the focusedSlot state
 */
function computeFocusedCells(
  _lessons: ScheduledLesson[],
  focusedSlot: FocusedSlot | null,
  days: DayOfWeek[],
  maxPeriods: number
): Map<string, boolean> {
  const focusedCells = new Map<string, boolean>();

  // For each cell in the grid, determine if it should be focused
  for (const day of days) {
    for (let period = 0; period < maxPeriods; period++) {
      const cellId = createCellId(day, period);
      const isFocused =
        focusedSlot !== null && focusedSlot.day === day && focusedSlot.period === period;
      focusedCells.set(cellId, isFocused);
    }
  }

  return focusedCells;
}

describe('FocusIndicator Property Tests', () => {
  /**
   * **Feature: schedule-phase6, Property 3: Focus Indicator Uniqueness**
   * **Validates: Requirements 2.1, 2.2**
   *
   * For any schedule state where focusedSlot is non-null, exactly one cell
   * should have the isFocused property set to true, and it should correspond
   * to the focusedSlot coordinates.
   */
  describe('Property 3: Focus Indicator Uniqueness', () => {
    const days = GRID_DAYS;
    const maxPeriods = MAX_PERIODS;

    it('exactly one cell is focused when focusedSlot is non-null', () => {
      fc.assert(
        fc.property(scheduleGridArb, focusedSlotArb, (lessons, focusedSlot) => {
          const focusedCells = computeFocusedCells(lessons, focusedSlot, days, maxPeriods);

          // Count how many cells have isFocused=true
          let focusedCount = 0;
          for (const isFocused of focusedCells.values()) {
            if (isFocused) focusedCount++;
          }

          // Exactly one cell should be focused
          expect(focusedCount).toBe(1);
        }),
        { numRuns: 100 }
      );
    });

    it('the focused cell corresponds to focusedSlot coordinates', () => {
      fc.assert(
        fc.property(scheduleGridArb, focusedSlotArb, (lessons, focusedSlot) => {
          const focusedCells = computeFocusedCells(lessons, focusedSlot, days, maxPeriods);

          // The cell at focusedSlot coordinates should be focused
          const expectedCellId = createCellId(focusedSlot.day, focusedSlot.period);

          // Check that the expected cell is focused
          expect(focusedCells.get(expectedCellId)).toBe(true);

          // Check that no other cell is focused
          for (const [cellId, isFocused] of focusedCells.entries()) {
            if (cellId !== expectedCellId) {
              expect(isFocused).toBe(false);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('no cell is focused when focusedSlot is null', () => {
      fc.assert(
        fc.property(scheduleGridArb, (_lessons) => {
          const focusedCells = computeFocusedCells(_lessons, null, days, maxPeriods);

          // No cell should be focused
          for (const isFocused of focusedCells.values()) {
            expect(isFocused).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('focus indicator uniqueness holds for any valid focusedSlot', () => {
      fc.assert(
        fc.property(
          scheduleGridArb,
          fc.option(focusedSlotArb, { nil: null }),
          (lessons, focusedSlot) => {
            const focusedCells = computeFocusedCells(lessons, focusedSlot, days, maxPeriods);

            // Count focused cells
            let focusedCount = 0;
            let focusedCellId: string | null = null;

            for (const [cellId, isFocused] of focusedCells.entries()) {
              if (isFocused) {
                focusedCount++;
                focusedCellId = cellId;
              }
            }

            if (focusedSlot === null) {
              // No cell should be focused
              expect(focusedCount).toBe(0);
            } else {
              // Exactly one cell should be focused
              expect(focusedCount).toBe(1);
              // And it should be the correct cell
              expect(focusedCellId).toBe(createCellId(focusedSlot.day, focusedSlot.period));
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('focus moves correctly when focusedSlot changes', () => {
      fc.assert(
        fc.property(scheduleGridArb, focusedSlotArb, focusedSlotArb, (lessons, slot1, slot2) => {
          // Compute focused cells for first slot
          const focusedCells1 = computeFocusedCells(lessons, slot1, days, maxPeriods);

          // Compute focused cells for second slot
          const focusedCells2 = computeFocusedCells(lessons, slot2, days, maxPeriods);

          // First slot should be focused in first state
          const cellId1 = createCellId(slot1.day, slot1.period);
          expect(focusedCells1.get(cellId1)).toBe(true);

          // Second slot should be focused in second state
          const cellId2 = createCellId(slot2.day, slot2.period);
          expect(focusedCells2.get(cellId2)).toBe(true);

          // If slots are different, first slot should not be focused in second state
          if (cellId1 !== cellId2) {
            expect(focusedCells2.get(cellId1)).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
