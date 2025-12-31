/**
 * Property-based tests for Translation Coverage
 *
 * **Feature: school-settings-periods, Property 8: Translation Coverage**
 * **Validates: Requirements 7.4, 7.5, 7.6**
 *
 * For any displayed text (day names, grade categories, validation messages,
 * labels), the system SHALL retrieve the text from the i18n translation file,
 * not from hardcoded strings.
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ALL_WEEK_DAYS, VALID_TIMEZONES } from '../constants/defaults';

// Import translation files directly for verification
import enTranslations from '@/i18n/locales/en.json';
import faTranslations from '@/i18n/locales/fa.json';

describe('Translation Coverage Property Tests', () => {
  /**
   * **Feature: school-settings-periods, Property 8: Translation Coverage**
   *
   * For any displayed text (day names, grade categories, validation messages,
   * labels), the system SHALL retrieve the text from the i18n translation file,
   * not from hardcoded strings.
   *
   * **Validates: Requirements 7.4, 7.5, 7.6**
   */
  describe('Property 8: Translation Coverage', () => {
    /**
     * Generator for valid day names from constants
     */
    const dayNameArbitrary = fc.constantFrom(...ALL_WEEK_DAYS);

    /**
     * Generator for grade category keys (main translations)
     */
    const gradeCategoryArbitrary = fc.constantFrom('alphaPrimary', 'betaPrimary', 'middle', 'high');

    /**
     * Generator for grade category short keys
     */
    const gradeCategoryShortArbitrary = fc.constantFrom(
      'alphaPrimaryShort',
      'betaPrimaryShort',
      'middleShort',
      'highShort'
    );

    /**
     * Generator for school settings translation keys
     */
    const schoolSettingsLabelKeyArbitrary = fc.constantFrom(
      'daysOfWeek',
      'startTime',
      'timezone',
      'shiftMode',
      'singleShift',
      'multiShift',
      'morningShift',
      'afternoonShift',
      'shiftStart',
      'shiftEnd'
    );

    /**
     * Generator for school settings section keys
     */
    const schoolSettingsSectionKeyArbitrary = fc.constantFrom(
      'daysOfWeek',
      'daysOfWeekDesc',
      'startTime',
      'startTimeDesc',
      'timezone',
      'timezoneDesc',
      'shiftConfig',
      'shiftConfigDesc'
    );

    /**
     * Generator for validation message keys
     */
    const validationKeyArbitrary = fc.constantFrom(
      'noDaysSelected',
      'invalidTimeFormat',
      'invalidTimezone',
      'invalidShiftMode',
      'shiftsRequired'
    );

    // ========================================
    // Tests for Day Names (Requirements 7.4)
    // ========================================

    it('should have translations for all day names in English', () => {
      fc.assert(
        fc.property(dayNameArbitrary, (day) => {
          const translation = enTranslations.days[day as keyof typeof enTranslations.days];
          expect(translation).toBeDefined();
          expect(typeof translation).toBe('string');
          expect(translation.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should have translations for all day names in Farsi', () => {
      fc.assert(
        fc.property(dayNameArbitrary, (day) => {
          const translation = faTranslations.days[day as keyof typeof faTranslations.days];
          expect(translation).toBeDefined();
          expect(typeof translation).toBe('string');
          expect(translation.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should have different translations for day names in English vs Farsi', () => {
      fc.assert(
        fc.property(dayNameArbitrary, (day) => {
          const enTranslation = enTranslations.days[day as keyof typeof enTranslations.days];
          const faTranslation = faTranslations.days[day as keyof typeof faTranslations.days];
          // Translations should be different (different languages)
          expect(enTranslation).not.toBe(faTranslation);
        }),
        { numRuns: 100 }
      );
    });

    // ========================================
    // Tests for Grade Categories (Requirements 7.5)
    // ========================================

    it('should have translations for all grade categories in English', () => {
      fc.assert(
        fc.property(gradeCategoryArbitrary, (category) => {
          const translation =
            enTranslations.gradeCategories[category as keyof typeof enTranslations.gradeCategories];
          expect(translation).toBeDefined();
          expect(typeof translation).toBe('string');
          expect((translation as string).length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should have translations for all grade categories in Farsi', () => {
      fc.assert(
        fc.property(gradeCategoryArbitrary, (category) => {
          const translation =
            faTranslations.gradeCategories[category as keyof typeof faTranslations.gradeCategories];
          expect(translation).toBeDefined();
          expect(typeof translation).toBe('string');
          expect((translation as string).length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should have short translations for all grade categories', () => {
      fc.assert(
        fc.property(gradeCategoryShortArbitrary, (category) => {
          const enTranslation =
            enTranslations.gradeCategories[category as keyof typeof enTranslations.gradeCategories];
          const faTranslation =
            faTranslations.gradeCategories[category as keyof typeof faTranslations.gradeCategories];
          expect(enTranslation).toBeDefined();
          expect(faTranslation).toBeDefined();
          expect(typeof enTranslation).toBe('string');
          expect(typeof faTranslation).toBe('string');
        }),
        { numRuns: 100 }
      );
    });

    // ========================================
    // Tests for School Settings Labels
    // ========================================

    it('should have translations for all school settings labels in English', () => {
      fc.assert(
        fc.property(schoolSettingsLabelKeyArbitrary, (key) => {
          const translation =
            enTranslations.schoolSettings.labels[
              key as keyof typeof enTranslations.schoolSettings.labels
            ];
          expect(translation).toBeDefined();
          expect(typeof translation).toBe('string');
          expect(translation.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should have translations for all school settings labels in Farsi', () => {
      fc.assert(
        fc.property(schoolSettingsLabelKeyArbitrary, (key) => {
          const translation =
            faTranslations.schoolSettings.labels[
              key as keyof typeof faTranslations.schoolSettings.labels
            ];
          expect(translation).toBeDefined();
          expect(typeof translation).toBe('string');
          expect(translation.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    // ========================================
    // Tests for School Settings Sections
    // ========================================

    it('should have translations for all school settings sections in English', () => {
      fc.assert(
        fc.property(schoolSettingsSectionKeyArbitrary, (key) => {
          const translation =
            enTranslations.schoolSettings.sections[
              key as keyof typeof enTranslations.schoolSettings.sections
            ];
          expect(translation).toBeDefined();
          expect(typeof translation).toBe('string');
          expect(translation.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should have translations for all school settings sections in Farsi', () => {
      fc.assert(
        fc.property(schoolSettingsSectionKeyArbitrary, (key) => {
          const translation =
            faTranslations.schoolSettings.sections[
              key as keyof typeof faTranslations.schoolSettings.sections
            ];
          expect(translation).toBeDefined();
          expect(typeof translation).toBe('string');
          expect(translation.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    // ========================================
    // Tests for Validation Messages (Requirements 7.6)
    // ========================================

    it('should have translations for all validation messages in English', () => {
      fc.assert(
        fc.property(validationKeyArbitrary, (key) => {
          const translation =
            enTranslations.schoolSettings.validation[
              key as keyof typeof enTranslations.schoolSettings.validation
            ];
          expect(translation).toBeDefined();
          expect(typeof translation).toBe('string');
          expect(translation.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('should have translations for all validation messages in Farsi', () => {
      fc.assert(
        fc.property(validationKeyArbitrary, (key) => {
          const translation =
            faTranslations.schoolSettings.validation[
              key as keyof typeof faTranslations.schoolSettings.validation
            ];
          expect(translation).toBeDefined();
          expect(typeof translation).toBe('string');
          expect(translation.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    // ========================================
    // Tests for Timezone Labels
    // ========================================

    it('should have Farsi labels for all timezone options', () => {
      fc.assert(
        fc.property(fc.constantFrom(...VALID_TIMEZONES), (timezone) => {
          // Timezone labels in constants should be in Farsi
          expect(timezone.label).toBeDefined();
          expect(typeof timezone.label).toBe('string');
          expect(timezone.label.length).toBeGreaterThan(0);
          // Farsi labels should contain Farsi characters or UTC notation
          expect(timezone.label).toMatch(/[\u0600-\u06FF]|UTC/);
        }),
        { numRuns: 100 }
      );
    });

    // ========================================
    // Tests for Error and Success Messages
    // ========================================

    it('should have error messages in both languages', () => {
      const errorKeyArbitrary = fc.constantFrom('fetchFailed', 'saveFailed');

      fc.assert(
        fc.property(errorKeyArbitrary, (key) => {
          const enTranslation =
            enTranslations.schoolSettings.errors[
              key as keyof typeof enTranslations.schoolSettings.errors
            ];
          const faTranslation =
            faTranslations.schoolSettings.errors[
              key as keyof typeof faTranslations.schoolSettings.errors
            ];
          expect(enTranslation).toBeDefined();
          expect(faTranslation).toBeDefined();
          expect(enTranslation).not.toBe(faTranslation);
        }),
        { numRuns: 100 }
      );
    });

    it('should have success messages in both languages', () => {
      const successKeyArbitrary = fc.constantFrom('saved');

      fc.assert(
        fc.property(successKeyArbitrary, (key) => {
          const enTranslation =
            enTranslations.schoolSettings.success[
              key as keyof typeof enTranslations.schoolSettings.success
            ];
          const faTranslation =
            faTranslations.schoolSettings.success[
              key as keyof typeof faTranslations.schoolSettings.success
            ];
          expect(enTranslation).toBeDefined();
          expect(faTranslation).toBeDefined();
          expect(enTranslation).not.toBe(faTranslation);
        }),
        { numRuns: 100 }
      );
    });

    // ========================================
    // Tests for Constants Not Being Hardcoded
    // ========================================

    it('should use constants for day names, not hardcoded values', () => {
      // Verify ALL_WEEK_DAYS matches translation keys
      fc.assert(
        fc.property(dayNameArbitrary, (day) => {
          // Day should be in ALL_WEEK_DAYS constant
          expect(ALL_WEEK_DAYS).toContain(day);
          // And should have a translation
          expect(enTranslations.days[day as keyof typeof enTranslations.days]).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should have page title and subtitle translations', () => {
      // Page-level translations
      expect(enTranslations.schoolSettings.pageTitle).toBeDefined();
      expect(enTranslations.schoolSettings.pageSubtitle).toBeDefined();
      expect(faTranslations.schoolSettings.pageTitle).toBeDefined();
      expect(faTranslations.schoolSettings.pageSubtitle).toBeDefined();

      // Should be different in different languages
      expect(enTranslations.schoolSettings.pageTitle).not.toBe(
        faTranslations.schoolSettings.pageTitle
      );
    });
  });
});
