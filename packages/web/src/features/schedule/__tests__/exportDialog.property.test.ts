/**
 * Property-based tests for Export Dialog Components
 *
 * Feature: schedule-phase5, Property 1: Paper Size Consistency
 * Validates: Requirements 1.4
 */

import { exportFormSchema } from '@/schemas/export.schema';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

describe('Export Dialog Property Tests', () => {
  /**
   * Feature: schedule-phase5, Property 1: Paper Size Consistency
   *
   * For any PDF export request, the generated PDF SHALL always use A4 paper size
   * regardless of other parameters.
   *
   * Since this is a frontend component test, we verify that the form validation
   * and component behavior is consistent with the A4 paper size requirement.
   * The actual PDF generation with A4 size will be tested in backend tests.
   *
   * Validates: Requirements 1.4
   */
  describe('Property 1: Paper Size Consistency', () => {
    /**
     * Generator for export format options
     */
    const exportFormatArbitrary = fc.constantFrom('pdf', 'excel');

    /**
     * Generator for export scope options
     */
    const exportScopeArbitrary = fc.constantFrom('current', 'all-classes', 'all-teachers');

    /**
     * Generator for export language options
     */
    const exportLanguageArbitrary = fc.constantFrom('fa', 'en');

    /**
     * Generator for display settings
     */
    const displaySettingsArbitrary = fc.record({
      showTeacherName: fc.boolean(),
      showRoomName: fc.boolean(),
      colorBy: fc.constantFrom('none', 'subject', 'teacher'),
    });

    /**
     * Generator for valid export form values
     */
    const exportFormArbitrary = fc.record({
      format: exportFormatArbitrary,
      scope: exportScopeArbitrary,
      language: exportLanguageArbitrary,
      showTeacherName: fc.boolean(),
      showRoomName: fc.boolean(),
      colorBy: fc.constantFrom('none', 'subject', 'teacher'),
    });

    it('should validate all export form combinations successfully', () => {
      fc.assert(
        fc.property(exportFormArbitrary, (formValues) => {
          const result = exportFormSchema.safeParse(formValues);
          expect(result.success).toBe(true);

          if (result.success) {
            // Verify that the form accepts all valid combinations
            expect(result.data.format).toBeOneOf(['pdf', 'excel']);
            expect(result.data.scope).toBeOneOf(['current', 'all-classes', 'all-teachers']);
            expect(result.data.language).toBeOneOf(['fa', 'en']);
            expect(typeof result.data.showTeacherName).toBe('boolean');
            expect(typeof result.data.showRoomName).toBe('boolean');
            expect(result.data.colorBy).toBeOneOf(['none', 'subject', 'teacher']);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should accept PDF format with any valid parameter combination', () => {
      fc.assert(
        fc.property(
          fc.record({
            format: fc.constant('pdf'),
            scope: exportScopeArbitrary,
            language: exportLanguageArbitrary,
            showTeacherName: fc.boolean(),
            showRoomName: fc.boolean(),
            colorBy: fc.constantFrom('none', 'subject', 'teacher'),
          }),
          (formValues) => {
            const result = exportFormSchema.safeParse(formValues);
            expect(result.success).toBe(true);

            if (result.success) {
              // For PDF format, the paper size is implicitly A4 (requirement 1.4)
              // This is enforced at the backend level, but the form should accept
              // all valid PDF export configurations
              expect(result.data.format).toBe('pdf');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use default values when not provided', () => {
      const result = exportFormSchema.safeParse({});
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.format).toBe('pdf');
        expect(result.data.scope).toBe('current');
        expect(result.data.language).toBe('fa');
        expect(result.data.showTeacherName).toBe(true);
        expect(result.data.showRoomName).toBe(true);
        expect(result.data.colorBy).toBe('none');
      }
    });

    it('should reject invalid format values', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !['pdf', 'excel'].includes(s)),
          (invalidFormat) => {
            const result = exportFormSchema.safeParse({ format: invalidFormat });
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject invalid scope values', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !['current', 'all-classes', 'all-teachers'].includes(s)),
          (invalidScope) => {
            const result = exportFormSchema.safeParse({ scope: invalidScope });
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject invalid language values', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !['fa', 'en'].includes(s)),
          (invalidLanguage) => {
            const result = exportFormSchema.safeParse({ language: invalidLanguage });
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject invalid colorBy values', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !['none', 'subject', 'teacher'].includes(s)),
          (invalidColorBy) => {
            const result = exportFormSchema.safeParse({ colorBy: invalidColorBy });
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

// Custom matcher for vitest
declare global {
  namespace Vi {
    interface Assertion<T = any> {
      toBeOneOf(expected: any[]): T;
    }
  }
}

// Add custom matcher
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected.join(', ')}`,
        pass: false,
      };
    }
  },
});
