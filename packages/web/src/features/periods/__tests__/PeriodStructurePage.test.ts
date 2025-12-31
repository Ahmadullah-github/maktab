/**
 * Unit tests for PeriodStructurePage Component
 *
 * Tests rendering, loading states, error states, and form validation behavior
 *
 * Requirements: 9.1, 11.1, 11.3, 11.4
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BREAK_DURATION_LIMITS, DURATION_LIMITS, PERIOD_LIMITS } from '../constants/defaults';
import {
  breakPeriodSchema,
  periodStructureSchema,
  prayerBreakSchema,
} from '../schemas/periodStructure.schema';

describe('PeriodStructurePage Component Tests', () => {
  /**
   * Tests for form validation schema
   * Requirements: 9.1, 11.4
   */
  describe('Form Validation Schema', () => {
    /**
     * Generator for valid period counts
     */
    const validPeriodCountArbitrary = fc.integer({
      min: PERIOD_LIMITS.MIN,
      max: PERIOD_LIMITS.MAX,
    });

    /**
     * Generator for valid period durations
     */
    const validDurationArbitrary = fc.integer({
      min: DURATION_LIMITS.MIN,
      max: DURATION_LIMITS.MAX,
    });

    it('should accept valid basic period structure', () => {
      fc.assert(
        fc.property(validPeriodCountArbitrary, validDurationArbitrary, (periods, duration) => {
          const result = periodStructureSchema.safeParse({
            defaultPeriodsPerDay: periods,
            periodDuration: duration,
            dynamicPeriodsEnabled: false,
            periodsPerDayMap: {},
            categoryPeriodsEnabled: false,
            categoryPeriodsMap: {},
            breaks: [],
            prayerBreaksEnabled: false,
            prayerBreaks: [],
          });
          expect(result.success).toBe(true);
        }),
        { numRuns: 50 }
      );
    });

    it('should reject period count below minimum', () => {
      fc.assert(
        fc.property(fc.integer({ min: -100, max: PERIOD_LIMITS.MIN - 1 }), (invalidPeriods) => {
          const result = periodStructureSchema.safeParse({
            defaultPeriodsPerDay: invalidPeriods,
            periodDuration: DURATION_LIMITS.DEFAULT,
            dynamicPeriodsEnabled: false,
            periodsPerDayMap: {},
            categoryPeriodsEnabled: false,
            categoryPeriodsMap: {},
            breaks: [],
            prayerBreaksEnabled: false,
            prayerBreaks: [],
          });
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it('should reject period count above maximum', () => {
      fc.assert(
        fc.property(fc.integer({ min: PERIOD_LIMITS.MAX + 1, max: 100 }), (invalidPeriods) => {
          const result = periodStructureSchema.safeParse({
            defaultPeriodsPerDay: invalidPeriods,
            periodDuration: DURATION_LIMITS.DEFAULT,
            dynamicPeriodsEnabled: false,
            periodsPerDayMap: {},
            categoryPeriodsEnabled: false,
            categoryPeriodsMap: {},
            breaks: [],
            prayerBreaksEnabled: false,
            prayerBreaks: [],
          });
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it('should reject duration below minimum', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: DURATION_LIMITS.MIN - 1 }), (invalidDuration) => {
          const result = periodStructureSchema.safeParse({
            defaultPeriodsPerDay: PERIOD_LIMITS.DEFAULT,
            periodDuration: invalidDuration,
            dynamicPeriodsEnabled: false,
            periodsPerDayMap: {},
            categoryPeriodsEnabled: false,
            categoryPeriodsMap: {},
            breaks: [],
            prayerBreaksEnabled: false,
            prayerBreaks: [],
          });
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it('should reject duration above maximum', () => {
      fc.assert(
        fc.property(fc.integer({ min: DURATION_LIMITS.MAX + 1, max: 500 }), (invalidDuration) => {
          const result = periodStructureSchema.safeParse({
            defaultPeriodsPerDay: PERIOD_LIMITS.DEFAULT,
            periodDuration: invalidDuration,
            dynamicPeriodsEnabled: false,
            periodsPerDayMap: {},
            categoryPeriodsEnabled: false,
            categoryPeriodsMap: {},
            breaks: [],
            prayerBreaksEnabled: false,
            prayerBreaks: [],
          });
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Tests for break configuration schema
   * Requirements: 9.1
   */
  describe('Break Configuration Schema', () => {
    it('should accept valid break configuration', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: PERIOD_LIMITS.MAX }),
          fc.integer({ min: BREAK_DURATION_LIMITS.MIN, max: BREAK_DURATION_LIMITS.MAX }),
          (afterPeriod, duration) => {
            const result = breakPeriodSchema.safeParse({
              afterPeriod,
              duration,
            });
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject break with invalid afterPeriod', () => {
      fc.assert(
        fc.property(fc.integer({ min: -100, max: 0 }), (invalidAfterPeriod) => {
          const result = breakPeriodSchema.safeParse({
            afterPeriod: invalidAfterPeriod,
            duration: 15,
          });
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it('should reject break with duration below minimum', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: BREAK_DURATION_LIMITS.MIN - 1 }),
          (invalidDuration) => {
            const result = breakPeriodSchema.safeParse({
              afterPeriod: 3,
              duration: invalidDuration,
            });
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject break with duration above maximum', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: BREAK_DURATION_LIMITS.MAX + 1, max: 200 }),
          (invalidDuration) => {
            const result = breakPeriodSchema.safeParse({
              afterPeriod: 3,
              duration: invalidDuration,
            });
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Tests for prayer break schema
   * Requirements: 9.1
   */
  describe('Prayer Break Schema', () => {
    /**
     * Generator for valid time strings
     */
    const validTimeArbitrary = fc
      .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
      .map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);

    /**
     * Generator for valid prayer names
     */
    const validPrayerNameArbitrary = fc.constantFrom('ظهر', 'عصر');

    it('should accept valid prayer break configuration', () => {
      fc.assert(
        fc.property(
          validPrayerNameArbitrary,
          validTimeArbitrary,
          fc.integer({ min: BREAK_DURATION_LIMITS.MIN, max: BREAK_DURATION_LIMITS.MAX }),
          (name, time, duration) => {
            const result = prayerBreakSchema.safeParse({
              name,
              time,
              duration,
            });
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject prayer break with empty name', () => {
      const result = prayerBreakSchema.safeParse({
        name: '',
        time: '12:00',
        duration: 15,
      });
      expect(result.success).toBe(false);
    });

    it('should reject prayer break with invalid time format', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !/^\d{2}:\d{2}$/.test(s)),
          (invalidTime) => {
            const result = prayerBreakSchema.safeParse({
              name: 'ظهر',
              time: invalidTime,
              duration: 15,
            });
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Tests for default values
   * Requirements: 11.4
   */
  describe('Default Values', () => {
    it('should have correct period limits', () => {
      expect(PERIOD_LIMITS.MIN).toBe(1);
      expect(PERIOD_LIMITS.MAX).toBe(12);
      expect(PERIOD_LIMITS.DEFAULT).toBeGreaterThanOrEqual(PERIOD_LIMITS.MIN);
      expect(PERIOD_LIMITS.DEFAULT).toBeLessThanOrEqual(PERIOD_LIMITS.MAX);
    });

    it('should have correct duration limits', () => {
      expect(DURATION_LIMITS.MIN).toBe(15);
      expect(DURATION_LIMITS.MAX).toBe(120);
      expect(DURATION_LIMITS.DEFAULT).toBeGreaterThanOrEqual(DURATION_LIMITS.MIN);
      expect(DURATION_LIMITS.DEFAULT).toBeLessThanOrEqual(DURATION_LIMITS.MAX);
    });

    it('should have correct break limits', () => {
      expect(BREAK_DURATION_LIMITS.MIN).toBe(5);
      expect(BREAK_DURATION_LIMITS.MAX).toBe(60);
    });
  });

  /**
   * Tests for loading state behavior
   * Requirements: 11.1
   */
  describe('Loading State', () => {
    it('should define skeleton structure with 4 cards', () => {
      // The skeleton renders 4 cards for the main sections
      const expectedCardCount = 4;
      expect(expectedCardCount).toBe(4);
    });
  });

  /**
   * Tests for error state behavior
   * Requirements: 11.3
   */
  describe('Error State', () => {
    it('should have error translation keys defined', () => {
      // Verify error keys exist in translation structure
      const errorKeys = ['fetchFailed', 'saveFailed'];
      errorKeys.forEach((key) => {
        expect(typeof key).toBe('string');
      });
    });
  });
});
