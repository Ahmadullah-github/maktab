/**
 * Property-based tests for Teacher constraint validation
 *
 * Feature: teachers-feature, Property 8: Constraint validation against dynamic limits
 * Feature: teachers-feature, Property 9: Default constraints derived from SchoolConfig
 * Validates: Requirements 5.1, 5.2, 5.3, 5.5
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  createTeacherFormSchemaWithConfig,
  getDefaultConstraints,
} from '../components/TeacherForm';
import { calculateMaxPeriodsPerWeek, type SchoolConfig } from '../hooks/useSchoolConfig';

/**
 * Generator for valid SchoolConfig objects
 * Generates realistic school configurations for Afghan schools
 */
const schoolConfigArbitrary = fc
  .record({
    id: fc.integer({ min: 1, max: 1000 }),
    schoolId: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: null }),
    schoolName: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
    daysPerWeek: fc.integer({ min: 5, max: 7 }),
    periodsPerDay: fc.integer({ min: 4, max: 10 }),
    defaultPeriodsPerDay: fc.integer({ min: 4, max: 10 }),
    daysOfWeek: fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
      minLength: 5,
      maxLength: 7,
    }),
    periodsPerDayMap: fc.option(
      fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.integer({ min: 1, max: 10 })),
      { nil: null }
    ),
    ramadanModeEnabled: fc.boolean(),
    ramadanPeriodDuration: fc.integer({ min: 30, max: 60 }),
    enableMinistryValidation: fc.boolean(),
    ministryValidationMode: fc.constantFrom('strict', 'lenient', 'off'),
    lowResourceMode: fc.boolean(),
  })
  .filter((config) => {
    // Ensure periodsPerDay is consistent with defaultPeriodsPerDay
    return config.periodsPerDay >= config.defaultPeriodsPerDay;
  }) as fc.Arbitrary<SchoolConfig>;

describe('Teacher Constraint Validation Property Tests', () => {
  /**
   * Feature: teachers-feature, Property 8: Constraint validation against dynamic limits
   *
   * For any SchoolConfig and any constraint values:
   * - maxPeriodsPerWeek SHALL be valid only if between 1 and (daysPerWeek × defaultPeriodsPerDay)
   * - maxPeriodsPerDay SHALL be valid only if between 1 and the maximum periods from SchoolConfig
   * - maxConsecutivePeriods SHALL be valid only if 1 or 2
   *
   * Validates: Requirements 5.1, 5.2, 5.3
   */
  describe('Property 8: Constraint validation against dynamic limits', () => {
    it('should accept maxPeriodsPerWeek within valid range (1 to daysPerWeek × defaultPeriodsPerDay)', () => {
      fc.assert(
        fc.property(schoolConfigArbitrary, (config) => {
          const schema = createTeacherFormSchemaWithConfig(config);
          const maxPeriodsPerWeek = calculateMaxPeriodsPerWeek(config);

          // Test valid values within range
          const validValues = [1, Math.floor(maxPeriodsPerWeek / 2), maxPeriodsPerWeek];

          for (const value of validValues) {
            if (value >= 1 && value <= maxPeriodsPerWeek) {
              const result = schema.safeParse({
                fullName: 'Test Teacher',
                maxPeriodsPerWeek: value,
                maxPeriodsPerDay: 1,
                maxConsecutivePeriods: 1,
              });
              expect(result.success).toBe(true);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should reject maxPeriodsPerWeek exceeding the calculated maximum', () => {
      fc.assert(
        fc.property(
          schoolConfigArbitrary,
          fc.integer({ min: 1, max: 100 }),
          (config, extraPeriods) => {
            const schema = createTeacherFormSchemaWithConfig(config);
            const maxPeriodsPerWeek = calculateMaxPeriodsPerWeek(config);
            const invalidValue = maxPeriodsPerWeek + extraPeriods;

            const result = schema.safeParse({
              fullName: 'Test Teacher',
              maxPeriodsPerWeek: invalidValue,
              maxPeriodsPerDay: 1,
              maxConsecutivePeriods: 1,
            });

            expect(result.success).toBe(false);
            if (!result.success) {
              expect(
                result.error.issues.some((issue) => issue.path.includes('maxPeriodsPerWeek'))
              ).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject maxPeriodsPerWeek less than 1', () => {
      fc.assert(
        fc.property(schoolConfigArbitrary, fc.integer({ min: -100, max: 0 }), (config, value) => {
          const schema = createTeacherFormSchemaWithConfig(config);

          const result = schema.safeParse({
            fullName: 'Test Teacher',
            maxPeriodsPerWeek: value,
            maxPeriodsPerDay: 1,
            maxConsecutivePeriods: 1,
          });

          expect(result.success).toBe(false);
          if (!result.success) {
            expect(
              result.error.issues.some((issue) => issue.path.includes('maxPeriodsPerWeek'))
            ).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should accept maxPeriodsPerDay within valid range (1 to defaultPeriodsPerDay)', () => {
      fc.assert(
        fc.property(schoolConfigArbitrary, (config) => {
          const schema = createTeacherFormSchemaWithConfig(config);
          const maxPeriodsPerDay = config.defaultPeriodsPerDay;

          // Test valid values within range
          const validValues = [1, Math.floor(maxPeriodsPerDay / 2), maxPeriodsPerDay];

          for (const value of validValues) {
            if (value >= 1 && value <= maxPeriodsPerDay) {
              const result = schema.safeParse({
                fullName: 'Test Teacher',
                maxPeriodsPerWeek: 1,
                maxPeriodsPerDay: value,
                maxConsecutivePeriods: 1,
              });
              expect(result.success).toBe(true);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should reject maxPeriodsPerDay exceeding defaultPeriodsPerDay', () => {
      fc.assert(
        fc.property(
          schoolConfigArbitrary,
          fc.integer({ min: 1, max: 100 }),
          (config, extraPeriods) => {
            const schema = createTeacherFormSchemaWithConfig(config);
            const invalidValue = config.defaultPeriodsPerDay + extraPeriods;

            const result = schema.safeParse({
              fullName: 'Test Teacher',
              maxPeriodsPerWeek: 1,
              maxPeriodsPerDay: invalidValue,
              maxConsecutivePeriods: 1,
            });

            expect(result.success).toBe(false);
            if (!result.success) {
              expect(
                result.error.issues.some((issue) => issue.path.includes('maxPeriodsPerDay'))
              ).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject maxPeriodsPerDay less than 1', () => {
      fc.assert(
        fc.property(schoolConfigArbitrary, fc.integer({ min: -100, max: 0 }), (config, value) => {
          const schema = createTeacherFormSchemaWithConfig(config);

          const result = schema.safeParse({
            fullName: 'Test Teacher',
            maxPeriodsPerWeek: 1,
            maxPeriodsPerDay: value,
            maxConsecutivePeriods: 1,
          });

          expect(result.success).toBe(false);
          if (!result.success) {
            expect(
              result.error.issues.some((issue) => issue.path.includes('maxPeriodsPerDay'))
            ).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should accept maxConsecutivePeriods of 1 or 2 only', () => {
      fc.assert(
        fc.property(schoolConfigArbitrary, fc.constantFrom(1, 2), (config, value) => {
          const schema = createTeacherFormSchemaWithConfig(config);

          const result = schema.safeParse({
            fullName: 'Test Teacher',
            maxPeriodsPerWeek: 1,
            maxPeriodsPerDay: 1,
            maxConsecutivePeriods: value,
          });

          expect(result.success).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject maxConsecutivePeriods greater than 2', () => {
      fc.assert(
        fc.property(schoolConfigArbitrary, fc.integer({ min: 3, max: 100 }), (config, value) => {
          const schema = createTeacherFormSchemaWithConfig(config);

          const result = schema.safeParse({
            fullName: 'Test Teacher',
            maxPeriodsPerWeek: 1,
            maxPeriodsPerDay: 1,
            maxConsecutivePeriods: value,
          });

          expect(result.success).toBe(false);
          if (!result.success) {
            expect(
              result.error.issues.some((issue) => issue.path.includes('maxConsecutivePeriods'))
            ).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should reject maxConsecutivePeriods less than 1', () => {
      fc.assert(
        fc.property(schoolConfigArbitrary, fc.integer({ min: -100, max: 0 }), (config, value) => {
          const schema = createTeacherFormSchemaWithConfig(config);

          const result = schema.safeParse({
            fullName: 'Test Teacher',
            maxPeriodsPerWeek: 1,
            maxPeriodsPerDay: 1,
            maxConsecutivePeriods: value,
          });

          expect(result.success).toBe(false);
          if (!result.success) {
            expect(
              result.error.issues.some((issue) => issue.path.includes('maxConsecutivePeriods'))
            ).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: teachers-feature, Property 9: Default constraints derived from SchoolConfig
   *
   * For any SchoolConfig, a newly created teacher SHALL have default constraint values
   * that are within the valid ranges calculated from that SchoolConfig.
   *
   * Validates: Requirements 5.5
   */
  describe('Property 9: Default constraints derived from SchoolConfig', () => {
    it('should generate default maxPeriodsPerWeek within valid range', () => {
      fc.assert(
        fc.property(schoolConfigArbitrary, (config) => {
          const defaults = getDefaultConstraints(config);
          const maxAllowed = calculateMaxPeriodsPerWeek(config);

          expect(defaults.maxPeriodsPerWeek).toBeGreaterThanOrEqual(1);
          expect(defaults.maxPeriodsPerWeek).toBeLessThanOrEqual(maxAllowed);
        }),
        { numRuns: 100 }
      );
    });

    it('should generate default maxPeriodsPerDay within valid range', () => {
      fc.assert(
        fc.property(schoolConfigArbitrary, (config) => {
          const defaults = getDefaultConstraints(config);

          expect(defaults.maxPeriodsPerDay).toBeGreaterThanOrEqual(1);
          expect(defaults.maxPeriodsPerDay).toBeLessThanOrEqual(config.defaultPeriodsPerDay);
        }),
        { numRuns: 100 }
      );
    });

    it('should generate default maxConsecutivePeriods of 1 or 2', () => {
      fc.assert(
        fc.property(schoolConfigArbitrary, (config) => {
          const defaults = getDefaultConstraints(config);

          expect(defaults.maxConsecutivePeriods).toBeGreaterThanOrEqual(1);
          expect(defaults.maxConsecutivePeriods).toBeLessThanOrEqual(2);
        }),
        { numRuns: 100 }
      );
    });

    it('should generate defaults that pass schema validation', () => {
      fc.assert(
        fc.property(schoolConfigArbitrary, (config) => {
          const schema = createTeacherFormSchemaWithConfig(config);
          const defaults = getDefaultConstraints(config);

          const result = schema.safeParse({
            fullName: 'Test Teacher',
            maxPeriodsPerWeek: defaults.maxPeriodsPerWeek,
            maxPeriodsPerDay: defaults.maxPeriodsPerDay,
            maxConsecutivePeriods: defaults.maxConsecutivePeriods,
          });

          expect(result.success).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should set maxPeriodsPerWeek equal to daysPerWeek × defaultPeriodsPerDay', () => {
      fc.assert(
        fc.property(schoolConfigArbitrary, (config) => {
          const defaults = getDefaultConstraints(config);
          const expectedMax = config.daysPerWeek * config.defaultPeriodsPerDay;

          expect(defaults.maxPeriodsPerWeek).toBe(expectedMax);
        }),
        { numRuns: 100 }
      );
    });

    it('should set maxPeriodsPerDay equal to defaultPeriodsPerDay', () => {
      fc.assert(
        fc.property(schoolConfigArbitrary, (config) => {
          const defaults = getDefaultConstraints(config);

          expect(defaults.maxPeriodsPerDay).toBe(config.defaultPeriodsPerDay);
        }),
        { numRuns: 100 }
      );
    });

    it('should set maxConsecutivePeriods to 2 (default)', () => {
      fc.assert(
        fc.property(schoolConfigArbitrary, (config) => {
          const defaults = getDefaultConstraints(config);

          expect(defaults.maxConsecutivePeriods).toBe(2);
        }),
        { numRuns: 100 }
      );
    });
  });
});
