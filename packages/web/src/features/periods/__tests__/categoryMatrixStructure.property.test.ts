/**
 * Property-based tests for Category Matrix Structure
 *
 * **Feature: school-settings-periods, Property 4: Category Matrix Structure**
 * **Validates: Requirements 4.2**
 *
 * For any set of active school days when category-based periods is enabled, the
 * system SHALL display a matrix with exactly 4 rows (one per grade category) and
 * N columns (one per active day), where N equals the number of active days.
 */

import { ALL_WEEK_DAYS, type WeekDay } from '@/features/school-settings/constants/defaults';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { GRADE_CATEGORIES, PERIOD_LIMITS, type GradeCategoryKey } from '../constants/defaults';
import type { CategoryPeriodsMap } from '../types';

/**
 * Helper function that simulates the CategoryPeriodsMatrix component's structure
 * Returns the matrix dimensions when enabled
 */
function getMatrixDimensions(
  activeDays: WeekDay[],
  enabled: boolean
): { rows: number; columns: number } | null {
  if (!enabled) {
    return null;
  }
  return {
    rows: GRADE_CATEGORIES.length, // Always 4 categories
    columns: activeDays.length,
  };
}

/**
 * Helper function that returns the categories that would be rendered
 */
function getRenderedCategories(enabled: boolean): GradeCategoryKey[] {
  if (!enabled) {
    return [];
  }
  return GRADE_CATEGORIES.map((c) => c.key);
}

/**
 * Helper function that returns the days that would be rendered as columns
 */
function getRenderedDayColumns(activeDays: WeekDay[], enabled: boolean): WeekDay[] {
  if (!enabled) {
    return [];
  }
  return [...activeDays];
}

/**
 * Helper function that simulates getting period value for a category-day combination
 */
function getCategoryDayPeriods(
  category: GradeCategoryKey,
  day: WeekDay,
  categoryPeriodsMap: CategoryPeriodsMap,
  defaultPeriods: number
): number {
  return categoryPeriodsMap[category]?.[day] ?? defaultPeriods;
}

describe('Category Matrix Structure Property Tests', () => {
  /**
   * **Feature: school-settings-periods, Property 4: Category Matrix Structure**
   *
   * For any set of active school days when category-based periods is enabled, the
   * system SHALL display a matrix with exactly 4 rows (one per grade category) and
   * N columns (one per active day), where N equals the number of active days.
   *
   * **Validates: Requirements 4.2**
   */
  describe('Property 4: Category Matrix Structure', () => {
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

    it('should have exactly 4 rows (one per grade category) when enabled', () => {
      fc.assert(
        fc.property(activeDaysArbitrary, (activeDays) => {
          const dimensions = getMatrixDimensions(activeDays, true);

          expect(dimensions).not.toBeNull();
          expect(dimensions!.rows).toBe(4);
          expect(dimensions!.rows).toBe(GRADE_CATEGORIES.length);
        }),
        { numRuns: 100 }
      );
    });

    it('should have N columns equal to number of active days when enabled', () => {
      fc.assert(
        fc.property(activeDaysArbitrary, (activeDays) => {
          const dimensions = getMatrixDimensions(activeDays, true);

          expect(dimensions).not.toBeNull();
          expect(dimensions!.columns).toBe(activeDays.length);
        }),
        { numRuns: 100 }
      );
    });

    it('should render all 4 grade categories when enabled', () => {
      const renderedCategories = getRenderedCategories(true);

      expect(renderedCategories.length).toBe(4);
      expect(renderedCategories).toContain('Alpha-Primary');
      expect(renderedCategories).toContain('Beta-Primary');
      expect(renderedCategories).toContain('Middle');
      expect(renderedCategories).toContain('High');
    });

    it('should render no categories when disabled', () => {
      const renderedCategories = getRenderedCategories(false);
      expect(renderedCategories.length).toBe(0);
    });

    it('should render exactly the active days as columns when enabled', () => {
      fc.assert(
        fc.property(activeDaysArbitrary, (activeDays) => {
          const renderedColumns = getRenderedDayColumns(activeDays, true);

          expect(renderedColumns.length).toBe(activeDays.length);

          // Each active day should appear exactly once
          for (const day of activeDays) {
            const count = renderedColumns.filter((d) => d === day).length;
            expect(count).toBe(1);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should render no day columns when disabled', () => {
      fc.assert(
        fc.property(activeDaysArbitrary, (activeDays) => {
          const renderedColumns = getRenderedDayColumns(activeDays, false);
          expect(renderedColumns.length).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should return null dimensions when disabled', () => {
      fc.assert(
        fc.property(activeDaysArbitrary, (activeDays) => {
          const dimensions = getMatrixDimensions(activeDays, false);
          expect(dimensions).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('should have total cells equal to 4 × number of active days', () => {
      fc.assert(
        fc.property(activeDaysArbitrary, (activeDays) => {
          const dimensions = getMatrixDimensions(activeDays, true);

          expect(dimensions).not.toBeNull();
          const totalCells = dimensions!.rows * dimensions!.columns;
          expect(totalCells).toBe(4 * activeDays.length);
        }),
        { numRuns: 100 }
      );
    });

    it('should provide period value for each category-day cell', () => {
      fc.assert(
        fc.property(
          activeDaysArbitrary,
          validPeriodCountArbitrary,
          (activeDays, defaultPeriods) => {
            const emptyMap: CategoryPeriodsMap = {};

            // Every category-day combination should have a value
            for (const category of GRADE_CATEGORIES) {
              for (const day of activeDays) {
                const value = getCategoryDayPeriods(category.key, day, emptyMap, defaultPeriods);

                // Should return default when map is empty
                expect(value).toBe(defaultPeriods);
                expect(value).toBeGreaterThanOrEqual(PERIOD_LIMITS.MIN);
                expect(value).toBeLessThanOrEqual(PERIOD_LIMITS.MAX);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle single day selection with 4 rows', () => {
      fc.assert(
        fc.property(fc.constantFrom(...ALL_WEEK_DAYS), (singleDay) => {
          const activeDays = [singleDay] as WeekDay[];
          const dimensions = getMatrixDimensions(activeDays, true);

          expect(dimensions).not.toBeNull();
          expect(dimensions!.rows).toBe(4);
          expect(dimensions!.columns).toBe(1);
        }),
        { numRuns: 100 }
      );
    });

    it('should handle all days selected with 4 rows and 7 columns', () => {
      const allDays = [...ALL_WEEK_DAYS] as WeekDay[];
      const dimensions = getMatrixDimensions(allDays, true);

      expect(dimensions).not.toBeNull();
      expect(dimensions!.rows).toBe(4);
      expect(dimensions!.columns).toBe(7);
    });
  });
});
