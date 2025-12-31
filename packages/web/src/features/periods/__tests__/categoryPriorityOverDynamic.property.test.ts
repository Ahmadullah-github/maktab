/**
 * Property-based tests for Category Priority Over Dynamic
 *
 * **Feature: school-settings-periods, Property 6: Category Priority Over Dynamic**
 * **Validates: Requirements 4.5**
 *
 * For any configuration where both dynamic and category-based periods are enabled,
 * the effective period count for a category-day combination SHALL use the
 * category-based value, not the dynamic periods value.
 */

import { ALL_WEEK_DAYS, type WeekDay } from '@/features/school-settings/constants/defaults';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { GRADE_CATEGORIES, PERIOD_LIMITS, type GradeCategoryKey } from '../constants/defaults';
import type { CategoryPeriodsMap, PeriodsPerDayMap } from '../types';

/**
 * Helper function that calculates effective periods for a category-day combination
 * This mirrors the priority logic in the application
 *
 * Priority (when both enabled):
 * 1. Category-based value takes precedence
 * 2. Falls back to default if category value not set
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
  // Category takes priority when enabled
  if (categoryPeriodsEnabled) {
    return categoryPeriodsMap[category]?.[day] ?? defaultPeriods;
  }

  // Fall back to dynamic if category disabled
  if (dynamicPeriodsEnabled) {
    return periodsPerDayMap[day] ?? defaultPeriods;
  }

  return defaultPeriods;
}

describe('Category Priority Over Dynamic Property Tests', () => {
  /**
   * **Feature: school-settings-periods, Property 6: Category Priority Over Dynamic**
   *
   * For any configuration where both dynamic and category-based periods are enabled,
   * the effective period count for a category-day combination SHALL use the
   * category-based value, not the dynamic periods value.
   *
   * **Validates: Requirements 4.5**
   */
  describe('Property 6: Category Priority Over Dynamic', () => {
    /**
     * Generator for valid period counts
     */
    const validPeriodCountArbitrary = fc.integer({
      min: PERIOD_LIMITS.MIN,
      max: PERIOD_LIMITS.MAX,
    });

    /**
     * Generator for periodsPerDayMap with valid values (non-empty)
     */
    const nonEmptyPeriodsPerDayMapArbitrary = fc.dictionary(
      fc.constantFrom(...ALL_WEEK_DAYS),
      validPeriodCountArbitrary,
      { minKeys: 1, maxKeys: 7 }
    ) as fc.Arbitrary<PeriodsPerDayMap>;

    /**
     * Generator for categoryPeriodsMap with valid values (non-empty)
     */
    const nonEmptyCategoryPeriodsMapArbitrary = fc.dictionary(
      fc.constantFrom(...GRADE_CATEGORIES.map((c) => c.key)),
      fc.dictionary(fc.constantFrom(...ALL_WEEK_DAYS), validPeriodCountArbitrary, {
        minKeys: 1,
        maxKeys: 7,
      }),
      { minKeys: 1, maxKeys: 4 }
    ) as fc.Arbitrary<CategoryPeriodsMap>;

    it('should use category value over dynamic value when both enabled', () => {
      fc.assert(
        fc.property(
          validPeriodCountArbitrary,
          nonEmptyCategoryPeriodsMapArbitrary,
          nonEmptyPeriodsPerDayMapArbitrary,
          (defaultPeriods, categoryMap, dynamicMap) => {
            // For each category-day combination that exists in category map
            for (const category of Object.keys(categoryMap) as GradeCategoryKey[]) {
              for (const day of Object.keys(categoryMap[category] || {}) as WeekDay[]) {
                const categoryValue = categoryMap[category]?.[day];
                const dynamicValue = dynamicMap[day];

                const effectivePeriods = getEffectivePeriods(
                  category,
                  day,
                  true, // category enabled
                  categoryMap,
                  true, // dynamic enabled
                  dynamicMap,
                  defaultPeriods
                );

                // Should use category value, not dynamic
                expect(effectivePeriods).toBe(categoryValue);

                // Verify it's different from dynamic when they differ
                if (dynamicValue !== undefined && dynamicValue !== categoryValue) {
                  expect(effectivePeriods).not.toBe(dynamicValue);
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ignore dynamic values completely when category is enabled', () => {
      fc.assert(
        fc.property(
          validPeriodCountArbitrary,
          nonEmptyCategoryPeriodsMapArbitrary,
          nonEmptyPeriodsPerDayMapArbitrary,
          (defaultPeriods, categoryMap, dynamicMap) => {
            for (const category of GRADE_CATEGORIES) {
              for (const day of ALL_WEEK_DAYS) {
                const effectiveWithDynamic = getEffectivePeriods(
                  category.key,
                  day,
                  true, // category enabled
                  categoryMap,
                  true, // dynamic enabled
                  dynamicMap,
                  defaultPeriods
                );

                const effectiveWithoutDynamic = getEffectivePeriods(
                  category.key,
                  day,
                  true, // category enabled
                  categoryMap,
                  false, // dynamic disabled
                  dynamicMap,
                  defaultPeriods
                );

                // Result should be the same regardless of dynamic enabled state
                expect(effectiveWithDynamic).toBe(effectiveWithoutDynamic);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fall back to default (not dynamic) when category value missing', () => {
      fc.assert(
        fc.property(
          validPeriodCountArbitrary,
          nonEmptyPeriodsPerDayMapArbitrary,
          (defaultPeriods, dynamicMap) => {
            const emptyCategoryMap: CategoryPeriodsMap = {};

            for (const category of GRADE_CATEGORIES) {
              for (const day of Object.keys(dynamicMap) as WeekDay[]) {
                const dynamicValue = dynamicMap[day];

                const effectivePeriods = getEffectivePeriods(
                  category.key,
                  day,
                  true, // category enabled
                  emptyCategoryMap,
                  true, // dynamic enabled
                  dynamicMap,
                  defaultPeriods
                );

                // Should use default, not dynamic value
                expect(effectivePeriods).toBe(defaultPeriods);

                // Verify it's different from dynamic when they differ
                if (dynamicValue !== defaultPeriods) {
                  expect(effectivePeriods).not.toBe(dynamicValue);
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow different values per category for same day', () => {
      fc.assert(
        fc.property(validPeriodCountArbitrary, (defaultPeriods) => {
          // Create category map with different values for each category on Monday
          const categoryMap: CategoryPeriodsMap = {
            'Alpha-Primary': { Monday: 5 },
            'Beta-Primary': { Monday: 6 },
            Middle: { Monday: 7 },
            High: { Monday: 8 },
          };

          const dynamicMap: PeriodsPerDayMap = { Monday: 10 }; // Different value

          const results = GRADE_CATEGORIES.map((category) =>
            getEffectivePeriods(
              category.key,
              'Monday',
              true,
              categoryMap,
              true,
              dynamicMap,
              defaultPeriods
            )
          );

          // Each category should have its own value
          expect(results[0]).toBe(5); // Alpha-Primary
          expect(results[1]).toBe(6); // Beta-Primary
          expect(results[2]).toBe(7); // Middle
          expect(results[3]).toBe(8); // High

          // None should use the dynamic value
          for (const result of results) {
            expect(result).not.toBe(10);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should use dynamic value only when category is disabled', () => {
      fc.assert(
        fc.property(
          validPeriodCountArbitrary,
          nonEmptyCategoryPeriodsMapArbitrary,
          nonEmptyPeriodsPerDayMapArbitrary,
          (defaultPeriods, categoryMap, dynamicMap) => {
            for (const day of Object.keys(dynamicMap) as WeekDay[]) {
              const dynamicValue = dynamicMap[day];

              for (const category of GRADE_CATEGORIES) {
                const effectivePeriods = getEffectivePeriods(
                  category.key,
                  day,
                  false, // category disabled
                  categoryMap,
                  true, // dynamic enabled
                  dynamicMap,
                  defaultPeriods
                );

                // Should use dynamic value when category disabled
                expect(effectivePeriods).toBe(dynamicValue);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle partial category map (some categories missing)', () => {
      fc.assert(
        fc.property(
          validPeriodCountArbitrary,
          nonEmptyPeriodsPerDayMapArbitrary,
          (defaultPeriods, dynamicMap) => {
            // Only Alpha-Primary has values
            const partialCategoryMap: CategoryPeriodsMap = {
              'Alpha-Primary': { Monday: 5, Tuesday: 6 },
            };

            const day = 'Monday' as WeekDay;
            const dynamicValue = dynamicMap[day] ?? defaultPeriods;

            // Alpha-Primary should use category value
            const alphaPrimaryResult = getEffectivePeriods(
              'Alpha-Primary',
              day,
              true,
              partialCategoryMap,
              true,
              dynamicMap,
              defaultPeriods
            );
            expect(alphaPrimaryResult).toBe(5);

            // Other categories should fall back to default (not dynamic)
            const betaPrimaryResult = getEffectivePeriods(
              'Beta-Primary',
              day,
              true,
              partialCategoryMap,
              true,
              dynamicMap,
              defaultPeriods
            );
            expect(betaPrimaryResult).toBe(defaultPeriods);

            // Verify Beta-Primary doesn't use dynamic value
            if (dynamicValue !== defaultPeriods) {
              expect(betaPrimaryResult).not.toBe(dynamicValue);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
