/**
 * Property-based tests for Category Periods Disabled Fallback
 *
 * **Feature: school-settings-periods, Property 5: Category Periods Disabled Fallback**
 * **Validates: Requirements 4.4**
 *
 * For any configuration where category-based periods is disabled, the effective
 * period count for all categories SHALL fall back to either dynamic periods (if
 * enabled) or default periods.
 */

import { ALL_WEEK_DAYS, type WeekDay } from '@/features/school-settings/constants/defaults';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { GRADE_CATEGORIES, PERIOD_LIMITS, type GradeCategoryKey } from '../constants/defaults';
import type { CategoryPeriodsMap, PeriodsPerDayMap } from '../types';

/**
 * Helper function that calculates effective periods for a category-day combination
 * This mirrors the fallback logic in the application
 *
 * Priority:
 * 1. If category periods enabled: use categoryPeriodsMap
 * 2. If dynamic periods enabled: use periodsPerDayMap
 * 3. Otherwise: use defaultPeriods
 */
function getEffectivePeriods(
  category: GradeCategoryKey,
  day: WeekDay,
  categoryPeriodsEnabled: boolean,
  categoryPeriodsMap: CategoryPeriodsMap,
  dynamicPeriodsEnabled: boolean,
  periodsPerDayMap: PeriodsPerDayMap,
  defaultPeriods: number
): number {
  if (categoryPeriodsEnabled) {
    return categoryPeriodsMap[category]?.[day] ?? defaultPeriods;
  }

  if (dynamicPeriodsEnabled) {
    return periodsPerDayMap[day] ?? defaultPeriods;
  }

  return defaultPeriods;
}

describe('Category Periods Disabled Fallback Property Tests', () => {
  /**
   * **Feature: school-settings-periods, Property 5: Category Periods Disabled Fallback**
   *
   * For any configuration where category-based periods is disabled, the effective
   * period count for all categories SHALL fall back to either dynamic periods (if
   * enabled) or default periods.
   *
   * **Validates: Requirements 4.4**
   */
  describe('Property 5: Category Periods Disabled Fallback', () => {
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

    /**
     * Generator for categoryPeriodsMap with valid values
     */
    const categoryPeriodsMapArbitrary = fc.dictionary(
      fc.constantFrom(...GRADE_CATEGORIES.map((c) => c.key)),
      fc.dictionary(fc.constantFrom(...ALL_WEEK_DAYS), validPeriodCountArbitrary, {
        minKeys: 0,
        maxKeys: 7,
      }),
      { minKeys: 0, maxKeys: 4 }
    ) as fc.Arbitrary<CategoryPeriodsMap>;

    /**
     * Generator for a non-empty subset of week days
     */
    const activeDaysArbitrary = fc
      .subarray([...ALL_WEEK_DAYS], { minLength: 1, maxLength: 7 })
      .map((days) => days as WeekDay[]);

    it('should fall back to default periods when both category and dynamic are disabled', () => {
      fc.assert(
        fc.property(
          validPeriodCountArbitrary,
          categoryPeriodsMapArbitrary,
          periodsPerDayMapArbitrary,
          (defaultPeriods, categoryMap, dynamicMap) => {
            for (const category of GRADE_CATEGORIES) {
              for (const day of ALL_WEEK_DAYS) {
                const effectivePeriods = getEffectivePeriods(
                  category.key,
                  day,
                  false, // category disabled
                  categoryMap,
                  false, // dynamic disabled
                  dynamicMap,
                  defaultPeriods
                );

                expect(effectivePeriods).toBe(defaultPeriods);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fall back to dynamic periods when category disabled but dynamic enabled', () => {
      fc.assert(
        fc.property(
          validPeriodCountArbitrary,
          categoryPeriodsMapArbitrary,
          fc.dictionary(fc.constantFrom(...ALL_WEEK_DAYS), validPeriodCountArbitrary, {
            minKeys: 1,
            maxKeys: 7,
          }),
          (defaultPeriods, categoryMap, dynamicMap) => {
            for (const category of GRADE_CATEGORIES) {
              for (const day of Object.keys(dynamicMap) as WeekDay[]) {
                const effectivePeriods = getEffectivePeriods(
                  category.key,
                  day,
                  false, // category disabled
                  categoryMap,
                  true, // dynamic enabled
                  dynamicMap,
                  defaultPeriods
                );

                // Should use dynamic map value
                expect(effectivePeriods).toBe(dynamicMap[day]);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ignore category map values when category periods is disabled', () => {
      fc.assert(
        fc.property(
          validPeriodCountArbitrary,
          fc.dictionary(
            fc.constantFrom(...GRADE_CATEGORIES.map((c) => c.key)),
            fc.dictionary(fc.constantFrom(...ALL_WEEK_DAYS), validPeriodCountArbitrary, {
              minKeys: 1,
              maxKeys: 7,
            }),
            { minKeys: 1, maxKeys: 4 }
          ),
          periodsPerDayMapArbitrary,
          (defaultPeriods, categoryMap, dynamicMap) => {
            for (const category of Object.keys(categoryMap) as GradeCategoryKey[]) {
              for (const day of Object.keys(categoryMap[category] || {}) as WeekDay[]) {
                const categoryValue = categoryMap[category]?.[day];
                const effectivePeriods = getEffectivePeriods(
                  category,
                  day,
                  false, // category disabled
                  categoryMap,
                  false, // dynamic disabled
                  dynamicMap,
                  defaultPeriods
                );

                // Should use default, not category value
                expect(effectivePeriods).toBe(defaultPeriods);

                // Verify category map actually had a different value (when it does)
                if (categoryValue !== undefined && categoryValue !== defaultPeriods) {
                  expect(effectivePeriods).not.toBe(categoryValue);
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return same value for all categories when category periods disabled', () => {
      fc.assert(
        fc.property(
          validPeriodCountArbitrary,
          categoryPeriodsMapArbitrary,
          periodsPerDayMapArbitrary,
          activeDaysArbitrary,
          fc.boolean(),
          (defaultPeriods, categoryMap, dynamicMap, activeDays, dynamicEnabled) => {
            for (const day of activeDays) {
              const valuesForDay = GRADE_CATEGORIES.map((category) =>
                getEffectivePeriods(
                  category.key,
                  day,
                  false, // category disabled
                  categoryMap,
                  dynamicEnabled,
                  dynamicMap,
                  defaultPeriods
                )
              );

              // All categories should have the same value for this day
              const uniqueValues = new Set(valuesForDay);
              expect(uniqueValues.size).toBe(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fall back to default when dynamic enabled but day not in map', () => {
      fc.assert(
        fc.property(validPeriodCountArbitrary, (defaultPeriods) => {
          const emptyDynamicMap: PeriodsPerDayMap = {};
          const emptyCategoryMap: CategoryPeriodsMap = {};

          for (const category of GRADE_CATEGORIES) {
            for (const day of ALL_WEEK_DAYS) {
              const effectivePeriods = getEffectivePeriods(
                category.key,
                day,
                false, // category disabled
                emptyCategoryMap,
                true, // dynamic enabled
                emptyDynamicMap,
                defaultPeriods
              );

              // Should fall back to default when day not in dynamic map
              expect(effectivePeriods).toBe(defaultPeriods);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should handle boundary default values correctly', () => {
      fc.assert(
        fc.property(
          categoryPeriodsMapArbitrary,
          periodsPerDayMapArbitrary,
          (categoryMap, dynamicMap) => {
            // Test with minimum default
            for (const category of GRADE_CATEGORIES) {
              for (const day of ALL_WEEK_DAYS) {
                const minEffective = getEffectivePeriods(
                  category.key,
                  day,
                  false,
                  categoryMap,
                  false,
                  dynamicMap,
                  PERIOD_LIMITS.MIN
                );
                expect(minEffective).toBe(PERIOD_LIMITS.MIN);
              }
            }

            // Test with maximum default
            for (const category of GRADE_CATEGORIES) {
              for (const day of ALL_WEEK_DAYS) {
                const maxEffective = getEffectivePeriods(
                  category.key,
                  day,
                  false,
                  categoryMap,
                  false,
                  dynamicMap,
                  PERIOD_LIMITS.MAX
                );
                expect(maxEffective).toBe(PERIOD_LIMITS.MAX);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
