/**
 * Property-based tests for AvailabilityMatrix component
 *
 * Feature: teachers-feature, Property 5: Availability matrix toggle is idempotent pair
 * Feature: teachers-feature, Property 6: Availability matrix dimensions match SchoolConfig
 * Validates: Requirements 4.1, 4.2, 4.5
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  getMaxPeriods,
  getPeriodsForDay,
  isSlotUnavailable,
  toggleSlot,
} from '../components/AvailabilityMatrix';
import type { UnavailableSlot } from '../types';

/**
 * Generator for UnavailableSlot
 */
const unavailableSlotArbitrary = fc.record({
  day: fc.integer({ min: 0, max: 6 }),
  period: fc.integer({ min: 0, max: 9 }),
});

/**
 * Generator for an array of unique UnavailableSlots (no duplicate day-period combinations)
 */
const uniqueUnavailableSlotsArbitrary = fc
  .array(unavailableSlotArbitrary, { minLength: 0, maxLength: 30 })
  .map((slots) => {
    // Remove duplicates by using a Set-like approach
    const seen = new Set<string>();
    return slots.filter((slot) => {
      const key = `${slot.day}-${slot.period}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

/**
 * Generator for days of week (Afghan school week)
 */
const daysOfWeekArbitrary: fc.Arbitrary<string[]> = fc.constantFrom(
  ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'] as string[],
  ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday'] as string[],
  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as string[]
);

/**
 * Generator for periodsPerDayMap (can be null or a map)
 */
const periodsPerDayMapArbitrary = (
  daysOfWeek: string[]
): fc.Arbitrary<Record<string, number> | null> =>
  fc.oneof(
    fc.constant(null),
    fc.record(
      Object.fromEntries(daysOfWeek.map((day) => [day, fc.integer({ min: 4, max: 10 })])) as Record<
        string,
        fc.Arbitrary<number>
      >
    )
  );

/**
 * Generator for defaultPeriodsPerDay
 */
const defaultPeriodsPerDayArbitrary = fc.integer({ min: 4, max: 10 });

describe('AvailabilityMatrix Property Tests', () => {
  /**
   * Feature: teachers-feature, Property 5: Availability matrix toggle is idempotent pair
   * For any availability matrix state and any valid cell (day, period), toggling
   * the cell twice SHALL return the matrix to its original state.
   * Validates: Requirements 4.2
   */
  describe('Property 5: Availability matrix toggle is idempotent pair', () => {
    it('toggling a cell twice should return to original state', () => {
      fc.assert(
        fc.property(
          uniqueUnavailableSlotsArbitrary,
          fc.integer({ min: 0, max: 6 }), // day
          fc.integer({ min: 0, max: 9 }), // period
          (slots: UnavailableSlot[], day: number, period: number) => {
            // Toggle once
            const afterFirstToggle = toggleSlot(slots, day, period);
            // Toggle again
            const afterSecondToggle = toggleSlot(afterFirstToggle, day, period);

            // Should be back to original state
            // Compare by checking same length and same slots
            expect(afterSecondToggle.length).toBe(slots.length);

            // Check that all original slots are present
            for (const slot of slots) {
              expect(isSlotUnavailable(afterSecondToggle, slot.day, slot.period)).toBe(true);
            }

            // Check that no extra slots were added
            for (const slot of afterSecondToggle) {
              expect(isSlotUnavailable(slots, slot.day, slot.period)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('toggling should flip the availability state', () => {
      fc.assert(
        fc.property(
          uniqueUnavailableSlotsArbitrary,
          fc.integer({ min: 0, max: 6 }),
          fc.integer({ min: 0, max: 9 }),
          (slots: UnavailableSlot[], day: number, period: number) => {
            const wasUnavailable = isSlotUnavailable(slots, day, period);
            const afterToggle = toggleSlot(slots, day, period);
            const isNowUnavailable = isSlotUnavailable(afterToggle, day, period);

            // State should be flipped
            expect(isNowUnavailable).toBe(!wasUnavailable);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('toggling should only affect the targeted cell', () => {
      fc.assert(
        fc.property(
          uniqueUnavailableSlotsArbitrary,
          fc.integer({ min: 0, max: 6 }),
          fc.integer({ min: 0, max: 9 }),
          (slots: UnavailableSlot[], targetDay: number, targetPeriod: number) => {
            const afterToggle = toggleSlot(slots, targetDay, targetPeriod);

            // Check all other cells remain unchanged
            for (let day = 0; day <= 6; day++) {
              for (let period = 0; period <= 9; period++) {
                if (day === targetDay && period === targetPeriod) {
                  continue; // Skip the toggled cell
                }
                const wasBefore = isSlotUnavailable(slots, day, period);
                const isAfter = isSlotUnavailable(afterToggle, day, period);
                expect(isAfter).toBe(wasBefore);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: teachers-feature, Property 6: Availability matrix dimensions match SchoolConfig
   * For any SchoolConfig with variable periodsPerDayMap, the availability matrix
   * SHALL have exactly the number of period rows specified for each day column.
   * Days without explicit mapping SHALL use defaultPeriodsPerDay.
   * Validates: Requirements 4.1, 4.5
   */
  describe('Property 6: Availability matrix dimensions match SchoolConfig', () => {
    it('getPeriodsForDay should return correct periods from map or default', () => {
      fc.assert(
        fc.property(
          daysOfWeekArbitrary,
          defaultPeriodsPerDayArbitrary,
          (daysOfWeek: string[], defaultPeriodsPerDay: number) => {
            // Generate a periodsPerDayMap for these days
            return fc.assert(
              fc.property(
                periodsPerDayMapArbitrary(daysOfWeek),
                (periodsPerDayMap: Record<string, number> | null) => {
                  for (const day of daysOfWeek) {
                    const periods = getPeriodsForDay(day, periodsPerDayMap, defaultPeriodsPerDay);

                    if (periodsPerDayMap && periodsPerDayMap[day] !== undefined) {
                      // Should use the map value
                      expect(periods).toBe(periodsPerDayMap[day]);
                    } else {
                      // Should use default
                      expect(periods).toBe(defaultPeriodsPerDay);
                    }
                  }
                }
              ),
              { numRuns: 10 }
            );
          }
        ),
        { numRuns: 10 }
      );
    });

    it('getMaxPeriods should return the maximum across all days', () => {
      fc.assert(
        fc.property(
          daysOfWeekArbitrary,
          defaultPeriodsPerDayArbitrary,
          (daysOfWeek: string[], defaultPeriodsPerDay: number) => {
            return fc.assert(
              fc.property(
                periodsPerDayMapArbitrary(daysOfWeek),
                (periodsPerDayMap: Record<string, number> | null) => {
                  const maxPeriods = getMaxPeriods(
                    daysOfWeek,
                    periodsPerDayMap,
                    defaultPeriodsPerDay
                  );

                  // Calculate expected max manually
                  let expectedMax = defaultPeriodsPerDay;
                  for (const day of daysOfWeek) {
                    const periods = getPeriodsForDay(day, periodsPerDayMap, defaultPeriodsPerDay);
                    if (periods > expectedMax) {
                      expectedMax = periods;
                    }
                  }

                  expect(maxPeriods).toBe(expectedMax);
                }
              ),
              { numRuns: 10 }
            );
          }
        ),
        { numRuns: 10 }
      );
    });

    it('getMaxPeriods should be at least defaultPeriodsPerDay', () => {
      fc.assert(
        fc.property(
          daysOfWeekArbitrary,
          defaultPeriodsPerDayArbitrary,
          (daysOfWeek: string[], defaultPeriodsPerDay: number) => {
            return fc.assert(
              fc.property(
                periodsPerDayMapArbitrary(daysOfWeek),
                (periodsPerDayMap: Record<string, number> | null) => {
                  const maxPeriods = getMaxPeriods(
                    daysOfWeek,
                    periodsPerDayMap,
                    defaultPeriodsPerDay
                  );
                  expect(maxPeriods).toBeGreaterThanOrEqual(defaultPeriodsPerDay);
                }
              ),
              { numRuns: 10 }
            );
          }
        ),
        { numRuns: 10 }
      );
    });

    it('with null periodsPerDayMap, getMaxPeriods should equal defaultPeriodsPerDay', () => {
      fc.assert(
        fc.property(
          daysOfWeekArbitrary,
          defaultPeriodsPerDayArbitrary,
          (daysOfWeek: string[], defaultPeriodsPerDay: number) => {
            const maxPeriods = getMaxPeriods(daysOfWeek, null, defaultPeriodsPerDay);
            expect(maxPeriods).toBe(defaultPeriodsPerDay);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('each day should have correct number of periods', () => {
      fc.assert(
        fc.property(
          daysOfWeekArbitrary,
          defaultPeriodsPerDayArbitrary,
          (daysOfWeek: string[], defaultPeriodsPerDay: number) => {
            return fc.assert(
              fc.property(
                periodsPerDayMapArbitrary(daysOfWeek),
                (periodsPerDayMap: Record<string, number> | null) => {
                  // Verify each day has the expected number of periods
                  for (const day of daysOfWeek) {
                    const periods = getPeriodsForDay(day, periodsPerDayMap, defaultPeriodsPerDay);

                    // Periods should be within valid range
                    expect(periods).toBeGreaterThanOrEqual(1);
                    expect(periods).toBeLessThanOrEqual(10);
                  }
                }
              ),
              { numRuns: 10 }
            );
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('isSlotUnavailable helper', () => {
    it('should return true only for slots in the array', () => {
      fc.assert(
        fc.property(
          uniqueUnavailableSlotsArbitrary,
          fc.integer({ min: 0, max: 6 }),
          fc.integer({ min: 0, max: 9 }),
          (slots: UnavailableSlot[], day: number, period: number) => {
            const isInArray = slots.some((s) => s.day === day && s.period === period);
            const result = isSlotUnavailable(slots, day, period);
            expect(result).toBe(isInArray);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return false for empty array', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 6 }),
          fc.integer({ min: 0, max: 9 }),
          (day: number, period: number) => {
            expect(isSlotUnavailable([], day, period)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
