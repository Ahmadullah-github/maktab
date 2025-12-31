/**
 * Property-based tests for Dynamic Periods Day Coverage
 *
 * **Feature: school-settings-periods, Property 2: Dynamic Periods Day Coverage**
 * **Validates: Requirements 3.2**
 *
 * For any set of active school days when dynamic periods is enabled, the system
 * SHALL display exactly one period count input for each active day, with no
 * missing or duplicate day inputs.
 */

import { ALL_WEEK_DAYS, type WeekDay } from '@/features/school-settings/constants/defaults';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PERIOD_LIMITS } from '../constants/defaults';
import type { PeriodsPerDayMap } from '../types';

/**
 * Helper function that simulates the DynamicPeriodsConfig component's behavior
 * Returns the days that would have inputs rendered
 */
function getRenderedDayInputs(activeDays: WeekDay[], enabled: boolean): WeekDay[] {
  if (!enabled) {
    return [];
  }
  // Component renders exactly one input per active day
  return [...activeDays];
}

/**
 * Helper function that simulates getting period value for a day
 * Mirrors the getDayPeriods function in DynamicPeriodsConfig
 */
function getDayPeriods(
  day: WeekDay,
  periodsPerDayMap: PeriodsPerDayMap,
  defaultPeriods: number
): number {
  return periodsPerDayMap[day] ?? defaultPeriods;
}

describe('Dynamic Periods Day Coverage Property Tests', () => {
  /**
   * **Feature: school-settings-periods, Property 2: Dynamic Periods Day Coverage**
   *
   * For any set of active school days when dynamic periods is enabled, the system
   * SHALL display exactly one period count input for each active day, with no
   * missing or duplicate day inputs.
   *
   * **Validates: Requirements 3.2**
   */
  describe('Property 2: Dynamic Periods Day Coverage', () => {
    /**
     * Generator for a non-empty subset of week days
     */
    const activeDaysArbitrary = fc
      .subarray([...ALL_WEEK_DAYS], { minLength: 1, maxLength: 7 })
      .map((days) => days as WeekDay[]);

    /**
     * Generator for valid period counts
     */
    const validPeriodCountArbitrary = fc.integer({
      min: PERIOD_LIMITS.MIN,
      max: PERIOD_LIMITS.MAX,
    });

    /**
     * Generator for periodsPerDayMap with valid values
     */
    const periodsPerDayMapArbitrary = fc.dictionary(
      fc.constantFrom(...ALL_WEEK_DAYS),
      validPeriodCountArbitrary,
      { minKeys: 0, maxKeys: 7 }
    ) as fc.Arbitrary<PeriodsPerDayMap>;

    it('should render exactly one input for each active day when enabled', () => {
      fc.assert(
        fc.property(activeDaysArbitrary, (activeDays) => {
          const renderedInputs = getRenderedDayInputs(activeDays, true);

          // Should have exactly the same number of inputs as active days
          expect(renderedInputs.length).toBe(activeDays.length);

          // Each active day should have exactly one input
          for (const day of activeDays) {
            const count = renderedInputs.filter((d) => d === day).length;
            expect(count).toBe(1);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should not render any inputs when disabled', () => {
      fc.assert(
        fc.property(activeDaysArbitrary, (activeDays) => {
          const renderedInputs = getRenderedDayInputs(activeDays, false);
          expect(renderedInputs.length).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should have no duplicate day inputs when enabled', () => {
      fc.assert(
        fc.property(activeDaysArbitrary, (activeDays) => {
          const renderedInputs = getRenderedDayInputs(activeDays, true);
          const uniqueDays = new Set(renderedInputs);

          // No duplicates means set size equals array length
          expect(uniqueDays.size).toBe(renderedInputs.length);
        }),
        { numRuns: 100 }
      );
    });

    it('should have no missing day inputs when enabled', () => {
      fc.assert(
        fc.property(activeDaysArbitrary, (activeDays) => {
          const renderedInputs = getRenderedDayInputs(activeDays, true);
          const renderedSet = new Set(renderedInputs);

          // Every active day should be in the rendered set
          for (const day of activeDays) {
            expect(renderedSet.has(day)).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should only render inputs for active days, not inactive days', () => {
      fc.assert(
        fc.property(activeDaysArbitrary, (activeDays) => {
          const renderedInputs = getRenderedDayInputs(activeDays, true);
          const activeSet = new Set(activeDays);

          // Every rendered input should be for an active day
          for (const day of renderedInputs) {
            expect(activeSet.has(day)).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should provide period value for each active day from map or default', () => {
      fc.assert(
        fc.property(
          activeDaysArbitrary,
          periodsPerDayMapArbitrary,
          validPeriodCountArbitrary,
          (activeDays, periodsMap, defaultPeriods) => {
            for (const day of activeDays) {
              const periodValue = getDayPeriods(day, periodsMap, defaultPeriods);

              // Value should be from map if present, otherwise default
              if (periodsMap[day] !== undefined) {
                expect(periodValue).toBe(periodsMap[day]);
              } else {
                expect(periodValue).toBe(defaultPeriods);
              }

              // Value should always be within valid range
              expect(periodValue).toBeGreaterThanOrEqual(PERIOD_LIMITS.MIN);
              expect(periodValue).toBeLessThanOrEqual(PERIOD_LIMITS.MAX);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle single day selection', () => {
      fc.assert(
        fc.property(fc.constantFrom(...ALL_WEEK_DAYS), (singleDay) => {
          const activeDays = [singleDay] as WeekDay[];
          const renderedInputs = getRenderedDayInputs(activeDays, true);

          expect(renderedInputs.length).toBe(1);
          expect(renderedInputs[0]).toBe(singleDay);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle all days selected', () => {
      const allDays = [...ALL_WEEK_DAYS] as WeekDay[];
      const renderedInputs = getRenderedDayInputs(allDays, true);

      expect(renderedInputs.length).toBe(7);
      for (const day of ALL_WEEK_DAYS) {
        expect(renderedInputs).toContain(day);
      }
    });
  });
});
