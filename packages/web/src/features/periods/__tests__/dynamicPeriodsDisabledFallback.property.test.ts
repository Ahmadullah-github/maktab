/**
 * Property-based tests for Dynamic Periods Disabled Fallback
 *
 * **Feature: school-settings-periods, Property 3: Dynamic Periods Disabled Fallback**
 * **Validates: Requirements 3.4**
 *
 * For any configuration where dynamic periods is disabled, the effective period
 * count for all days SHALL equal the default periods per day value.
 */

import { ALL_WEEK_DAYS, type WeekDay } from '@/features/school-settings/constants/defaults';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PERIOD_LIMITS } from '../constants/defaults';
import type { PeriodsPerDayMap } from '../types';

/**
 * Helper function that calculates effective periods for a day
 * This mirrors the logic that would be used in the application
 *
 * When dynamic periods is disabled, always returns defaultPeriods
 * When enabled, returns the value from periodsPerDayMap or defaultPeriods
 */
function getEffectivePeriods(
  day: WeekDay,
  dynamicPeriodsEnabled: boolean,
  periodsPerDayMap: PeriodsPerDayMap,
  defaultPeriods: number
): number {
  if (!dynamicPeriodsEnabled) {
    // When disabled, always use default periods
    return defaultPeriods;
  }
  // When enabled, use map value or fall back to default
  return periodsPerDayMap[day] ?? defaultPeriods;
}

describe('Dynamic Periods Disabled Fallback Property Tests', () => {
  /**
   * **Feature: school-settings-periods, Property 3: Dynamic Periods Disabled Fallback**
   *
   * For any configuration where dynamic periods is disabled, the effective period
   * count for all days SHALL equal the default periods per day value.
   *
   * **Validates: Requirements 3.4**
   */
  describe('Property 3: Dynamic Periods Disabled Fallback', () => {
    /**
     * Generator for valid period counts
     */
    const validPeriodCountArbitrary = fc.integer({
      min: PERIOD_LIMITS.MIN,
      max: PERIOD_LIMITS.MAX,
    });

    /**
     * Generator for periodsPerDayMap with valid values
     * This simulates a map that might have been configured before disabling
     */
    const periodsPerDayMapArbitrary = fc.dictionary(
      fc.constantFrom(...ALL_WEEK_DAYS),
      validPeriodCountArbitrary,
      { minKeys: 0, maxKeys: 7 }
    ) as fc.Arbitrary<PeriodsPerDayMap>;

    /**
     * Generator for a non-empty subset of week days
     */
    const activeDaysArbitrary = fc
      .subarray([...ALL_WEEK_DAYS], { minLength: 1, maxLength: 7 })
      .map((days) => days as WeekDay[]);

    it('should return default periods for all days when disabled', () => {
      fc.assert(
        fc.property(
          validPeriodCountArbitrary,
          periodsPerDayMapArbitrary,
          (defaultPeriods, periodsMap) => {
            // For every day of the week
            for (const day of ALL_WEEK_DAYS) {
              const effectivePeriods = getEffectivePeriods(
                day,
                false, // disabled
                periodsMap,
                defaultPeriods
              );

              // Should always equal default periods when disabled
              expect(effectivePeriods).toBe(defaultPeriods);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ignore periodsPerDayMap values when disabled', () => {
      fc.assert(
        fc.property(
          validPeriodCountArbitrary,
          fc.dictionary(fc.constantFrom(...ALL_WEEK_DAYS), validPeriodCountArbitrary, {
            minKeys: 1,
            maxKeys: 7,
          }),
          (defaultPeriods, periodsMap) => {
            // Even when map has different values
            for (const day of Object.keys(periodsMap) as WeekDay[]) {
              const mapValue = periodsMap[day];
              const effectivePeriods = getEffectivePeriods(day, false, periodsMap, defaultPeriods);

              // Should still use default, not map value
              expect(effectivePeriods).toBe(defaultPeriods);

              // Verify map actually had a different value (when it does)
              if (mapValue !== defaultPeriods) {
                expect(effectivePeriods).not.toBe(mapValue);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return consistent values across all active days when disabled', () => {
      fc.assert(
        fc.property(
          validPeriodCountArbitrary,
          periodsPerDayMapArbitrary,
          activeDaysArbitrary,
          (defaultPeriods, periodsMap, activeDays) => {
            const effectiveValues = activeDays.map((day) =>
              getEffectivePeriods(day, false, periodsMap, defaultPeriods)
            );

            // All values should be the same (the default)
            const uniqueValues = new Set(effectiveValues);
            expect(uniqueValues.size).toBe(1);
            expect(effectiveValues[0]).toBe(defaultPeriods);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use map values when enabled (contrast test)', () => {
      fc.assert(
        fc.property(
          validPeriodCountArbitrary,
          fc.dictionary(fc.constantFrom(...ALL_WEEK_DAYS), validPeriodCountArbitrary, {
            minKeys: 1,
            maxKeys: 7,
          }),
          (defaultPeriods, periodsMap) => {
            // When enabled, should use map values
            for (const day of Object.keys(periodsMap) as WeekDay[]) {
              const effectivePeriods = getEffectivePeriods(
                day,
                true, // enabled
                periodsMap,
                defaultPeriods
              );

              // Should use map value when enabled
              expect(effectivePeriods).toBe(periodsMap[day]);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fall back to default for unmapped days when enabled', () => {
      fc.assert(
        fc.property(validPeriodCountArbitrary, (defaultPeriods) => {
          const emptyMap: PeriodsPerDayMap = {};

          for (const day of ALL_WEEK_DAYS) {
            const effectivePeriods = getEffectivePeriods(
              day,
              true, // enabled
              emptyMap,
              defaultPeriods
            );

            // Should use default when map is empty
            expect(effectivePeriods).toBe(defaultPeriods);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should handle boundary default values correctly when disabled', () => {
      fc.assert(
        fc.property(periodsPerDayMapArbitrary, (periodsMap) => {
          // Test with minimum default
          for (const day of ALL_WEEK_DAYS) {
            const minEffective = getEffectivePeriods(day, false, periodsMap, PERIOD_LIMITS.MIN);
            expect(minEffective).toBe(PERIOD_LIMITS.MIN);
          }

          // Test with maximum default
          for (const day of ALL_WEEK_DAYS) {
            const maxEffective = getEffectivePeriods(day, false, periodsMap, PERIOD_LIMITS.MAX);
            expect(maxEffective).toBe(PERIOD_LIMITS.MAX);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
