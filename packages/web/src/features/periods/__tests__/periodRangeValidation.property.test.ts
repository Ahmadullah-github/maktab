/**
 * Property-based tests for Period Range Validation
 *
 * **Feature: school-settings-periods, Property 1: Period Range Validation**
 * **Validates: Requirements 3.3, 4.3**
 *
 * For any period count input (default periods, dynamic periods per day, or
 * category-based periods), the system SHALL reject values outside the range 1-12
 * and display a validation error.
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PERIOD_LIMITS } from '../constants/defaults';
import {
  categoryPeriodsMapSchema,
  periodCountSchema,
  periodStructureSchema,
  periodsPerDayMapSchema,
} from '../schemas/periodStructure.schema';

describe('Period Range Validation Property Tests', () => {
  /**
   * **Feature: school-settings-periods, Property 1: Period Range Validation**
   *
   * For any period count input (default periods, dynamic periods per day, or
   * category-based periods), the system SHALL reject values outside the range 1-12
   * and display a validation error.
   *
   * **Validates: Requirements 3.3, 4.3**
   */
  describe('Property 1: Period Range Validation', () => {
    /**
     * Generator for valid period counts (within range)
     */
    const validPeriodCountArbitrary = fc.integer({
      min: PERIOD_LIMITS.MIN,
      max: PERIOD_LIMITS.MAX,
    });

    /**
     * Generator for period counts below minimum
     */
    const belowMinPeriodArbitrary = fc.integer({
      min: -1000,
      max: PERIOD_LIMITS.MIN - 1,
    });

    /**
     * Generator for period counts above maximum
     */
    const aboveMaxPeriodArbitrary = fc.integer({
      min: PERIOD_LIMITS.MAX + 1,
      max: 1000,
    });

    /**
     * Generator for non-integer numbers
     */
    const nonIntegerArbitrary = fc
      .double({ min: 0.1, max: 100, noNaN: true })
      .filter((n) => !Number.isInteger(n));

    /**
     * Generator for valid day names
     */
    const validDayArbitrary = fc.constantFrom(
      'Saturday',
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday'
    );

    /**
     * Generator for valid grade category keys
     */
    const validCategoryArbitrary = fc.constantFrom(
      'Alpha-Primary',
      'Beta-Primary',
      'Middle',
      'High'
    );

    // ========================================
    // Tests for periodCountSchema (base schema)
    // ========================================

    it('should accept valid period counts within range', () => {
      fc.assert(
        fc.property(validPeriodCountArbitrary, (periodCount) => {
          const result = periodCountSchema.safeParse(periodCount);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data).toBe(periodCount);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should reject period counts below minimum', () => {
      fc.assert(
        fc.property(belowMinPeriodArbitrary, (periodCount) => {
          const result = periodCountSchema.safeParse(periodCount);
          expect(result.success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject period counts above maximum', () => {
      fc.assert(
        fc.property(aboveMaxPeriodArbitrary, (periodCount) => {
          const result = periodCountSchema.safeParse(periodCount);
          expect(result.success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject non-integer period counts', () => {
      fc.assert(
        fc.property(nonIntegerArbitrary, (periodCount) => {
          const result = periodCountSchema.safeParse(periodCount);
          expect(result.success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should accept boundary values (MIN and MAX)', () => {
      const minResult = periodCountSchema.safeParse(PERIOD_LIMITS.MIN);
      expect(minResult.success).toBe(true);

      const maxResult = periodCountSchema.safeParse(PERIOD_LIMITS.MAX);
      expect(maxResult.success).toBe(true);
    });

    // ========================================
    // Tests for periodsPerDayMap (dynamic periods)
    // ========================================

    it('should accept valid periodsPerDayMap with valid period counts', () => {
      fc.assert(
        fc.property(
          fc.dictionary(validDayArbitrary, validPeriodCountArbitrary, {
            minKeys: 1,
            maxKeys: 7,
          }),
          (periodsMap) => {
            const result = periodsPerDayMapSchema.safeParse(periodsMap);
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject periodsPerDayMap with period counts below minimum', () => {
      fc.assert(
        fc.property(
          fc.tuple(validDayArbitrary, belowMinPeriodArbitrary),
          ([day, invalidPeriod]) => {
            const periodsMap = { [day]: invalidPeriod };
            const result = periodsPerDayMapSchema.safeParse(periodsMap);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject periodsPerDayMap with period counts above maximum', () => {
      fc.assert(
        fc.property(
          fc.tuple(validDayArbitrary, aboveMaxPeriodArbitrary),
          ([day, invalidPeriod]) => {
            const periodsMap = { [day]: invalidPeriod };
            const result = periodsPerDayMapSchema.safeParse(periodsMap);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    // ========================================
    // Tests for categoryPeriodsMap (category-based periods)
    // ========================================

    it('should accept valid categoryPeriodsMap with valid period counts', () => {
      fc.assert(
        fc.property(
          fc.dictionary(
            validCategoryArbitrary,
            fc.dictionary(validDayArbitrary, validPeriodCountArbitrary, {
              minKeys: 1,
              maxKeys: 7,
            }),
            { minKeys: 1, maxKeys: 4 }
          ),
          (categoryMap) => {
            const result = categoryPeriodsMapSchema.safeParse(categoryMap);
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject categoryPeriodsMap with period counts below minimum', () => {
      fc.assert(
        fc.property(
          fc.tuple(validCategoryArbitrary, validDayArbitrary, belowMinPeriodArbitrary),
          ([category, day, invalidPeriod]) => {
            const categoryMap = { [category]: { [day]: invalidPeriod } };
            const result = categoryPeriodsMapSchema.safeParse(categoryMap);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject categoryPeriodsMap with period counts above maximum', () => {
      fc.assert(
        fc.property(
          fc.tuple(validCategoryArbitrary, validDayArbitrary, aboveMaxPeriodArbitrary),
          ([category, day, invalidPeriod]) => {
            const categoryMap = { [category]: { [day]: invalidPeriod } };
            const result = categoryPeriodsMapSchema.safeParse(categoryMap);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    // ========================================
    // Tests for full periodStructureSchema
    // ========================================

    it('should accept valid defaultPeriodsPerDay in full schema', () => {
      fc.assert(
        fc.property(validPeriodCountArbitrary, (periodCount) => {
          const result = periodStructureSchema.safeParse({
            defaultPeriodsPerDay: periodCount,
            periodDuration: 45,
            dynamicPeriodsEnabled: false,
            categoryPeriodsEnabled: false,
            prayerBreaksEnabled: false,
          });
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject invalid defaultPeriodsPerDay in full schema', () => {
      fc.assert(
        fc.property(fc.oneof(belowMinPeriodArbitrary, aboveMaxPeriodArbitrary), (invalidPeriod) => {
          const result = periodStructureSchema.safeParse({
            defaultPeriodsPerDay: invalidPeriod,
            periodDuration: 45,
            dynamicPeriodsEnabled: false,
            categoryPeriodsEnabled: false,
            prayerBreaksEnabled: false,
          });
          expect(result.success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });
});
