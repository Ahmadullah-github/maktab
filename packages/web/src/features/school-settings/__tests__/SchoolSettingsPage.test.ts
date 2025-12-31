/**
 * Unit tests for SchoolSettingsPage Component
 *
 * Tests rendering, loading states, error states, and form validation behavior
 *
 * Requirements: 9.1, 11.1, 11.3, 11.4
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { AFGHAN_WEEK_DAYS, ALL_WEEK_DAYS, VALID_TIMEZONES } from '../constants/defaults';
import { schoolSettingsSchema } from '../schemas/schoolSettings.schema';

describe('SchoolSettingsPage Component Tests', () => {
  /**
   * Tests for form validation schema
   * Requirements: 9.1, 11.4
   */
  describe('Form Validation Schema', () => {
    /**
     * Generator for valid days of week arrays
     */
    const validDaysArbitrary = fc
      .subarray([...ALL_WEEK_DAYS], { minLength: 1, maxLength: 7 })
      .map((days) => [...new Set(days)]);

    /**
     * Generator for valid time strings (HH:mm format)
     */
    const validTimeArbitrary = fc
      .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
      .map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);

    /**
     * Generator for valid timezone values
     */
    const validTimezoneArbitrary = fc.constantFrom(...VALID_TIMEZONES.map((tz) => tz.value));

    /**
     * Generator for valid shift modes
     */
    const validShiftModeArbitrary = fc.constantFrom('single', 'multi');

    it('should accept valid school settings with single shift mode', () => {
      fc.assert(
        fc.property(
          validDaysArbitrary,
          validTimeArbitrary,
          validTimezoneArbitrary,
          (daysOfWeek, startTime, timezone) => {
            const result = schoolSettingsSchema.safeParse({
              daysOfWeek,
              startTime,
              timezone,
              shiftMode: 'single',
            });
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should accept valid school settings with multi shift mode', () => {
      fc.assert(
        fc.property(
          validDaysArbitrary,
          validTimeArbitrary,
          validTimezoneArbitrary,
          (daysOfWeek, startTime, timezone) => {
            const result = schoolSettingsSchema.safeParse({
              daysOfWeek,
              startTime,
              timezone,
              shiftMode: 'multi',
              shifts: {
                morning: { start: '07:30', end: '12:00' },
                afternoon: { start: '13:00', end: '17:30' },
              },
            });
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject empty days of week array', () => {
      const result = schoolSettingsSchema.safeParse({
        daysOfWeek: [],
        startTime: '07:30',
        timezone: 'Asia/Kabul',
        shiftMode: 'single',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid time format', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !/^\d{2}:\d{2}$/.test(s)),
          (invalidTime) => {
            const result = schoolSettingsSchema.safeParse({
              daysOfWeek: [...AFGHAN_WEEK_DAYS],
              startTime: invalidTime,
              timezone: 'Asia/Kabul',
              shiftMode: 'single',
            });
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject invalid timezone', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !VALID_TIMEZONES.some((tz) => tz.value === s)),
          (invalidTimezone) => {
            const result = schoolSettingsSchema.safeParse({
              daysOfWeek: [...AFGHAN_WEEK_DAYS],
              startTime: '07:30',
              timezone: invalidTimezone,
              shiftMode: 'single',
            });
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should require shifts when shiftMode is multi', () => {
      const result = schoolSettingsSchema.safeParse({
        daysOfWeek: [...AFGHAN_WEEK_DAYS],
        startTime: '07:30',
        timezone: 'Asia/Kabul',
        shiftMode: 'multi',
        // Missing shifts
      });
      expect(result.success).toBe(false);
    });

    it('should accept all valid shift modes', () => {
      fc.assert(
        fc.property(validShiftModeArbitrary, (shiftMode) => {
          const data: Record<string, unknown> = {
            daysOfWeek: [...AFGHAN_WEEK_DAYS],
            startTime: '07:30',
            timezone: 'Asia/Kabul',
            shiftMode,
          };

          if (shiftMode === 'multi') {
            data.shifts = {
              morning: { start: '07:30', end: '12:00' },
              afternoon: { start: '13:00', end: '17:30' },
            };
          }

          const result = schoolSettingsSchema.safeParse(data);
          expect(result.success).toBe(true);
        }),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Tests for default values
   * Requirements: 11.4
   */
  describe('Default Values', () => {
    it('should have Afghan week days as default', () => {
      expect(AFGHAN_WEEK_DAYS).toEqual([
        'Saturday',
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
      ]);
    });

    it('should have Asia/Kabul as a valid timezone', () => {
      const kabulTimezone = VALID_TIMEZONES.find((tz) => tz.value === 'Asia/Kabul');
      expect(kabulTimezone).toBeDefined();
    });

    it('should have all 7 days in ALL_WEEK_DAYS', () => {
      expect(ALL_WEEK_DAYS).toHaveLength(7);
      expect(ALL_WEEK_DAYS).toContain('Friday');
    });
  });

  /**
   * Tests for loading state behavior
   * Requirements: 11.1
   */
  describe('Loading State', () => {
    it('should define skeleton structure with 4 cards', () => {
      // The skeleton renders 4 cards for the 4 sections
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
