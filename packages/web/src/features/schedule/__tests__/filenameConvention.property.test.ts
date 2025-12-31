/**
 * Property-Based Test: Filename Convention Compliance
 *
 * **Feature: schedule-phase5, Property 3: Filename Convention Compliance**
 * **Validates: Requirements 2.5, 8.4**
 *
 * Tests that generated filenames always match the expected pattern:
 * schedule_{scope-prefix}{type}_{name}_{language}_{date}.{extension}
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { generateExportFilename } from '../api/export.api';

describe('Property Test: Filename Convention Compliance', () => {
  it('**Feature: schedule-phase5, Property 3: Filename Convention Compliance**', () => {
    const typeArb = fc.constantFrom('class' as const, 'teacher' as const);
    const languageArb = fc.constantFrom('fa' as const, 'en' as const);
    const formatArb = fc.constantFrom('pdf' as const, 'excel' as const);
    const scopeArb = fc.constantFrom(
      'current' as const,
      'all-classes' as const,
      'all-teachers' as const
    );

    // Generate names that contain at least one alphanumeric or Persian character
    const nameArb = fc.string({ minLength: 1, maxLength: 50 }).filter((name) => {
      return /[a-zA-Z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(
        name
      );
    });

    fc.assert(
      fc.property(
        typeArb,
        nameArb,
        languageArb,
        formatArb,
        scopeArb,
        (type, name, language, format, scope) => {
          const filename = generateExportFilename(type, name, language, format, scope);
          const currentDate = new Date().toISOString().split('T')[0];
          const expectedScopePrefix = scope === 'current' ? '' : 'all-';
          const expectedExtension = format === 'excel' ? 'xlsx' : 'pdf';
          const sanitizedName = name.replace(
            /[^a-zA-Z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF-_]/g,
            '-'
          );
          const expectedPattern = `schedule_${expectedScopePrefix}${type}_${sanitizedName}_${language}_${currentDate}.${expectedExtension}`;

          expect(filename).toBe(expectedPattern);
          expect(filename).toContain('schedule_');
          // Type appears after scope prefix: schedule_{scope-prefix}{type}_
          expect(filename).toContain(`${type}_`);
          expect(filename).toContain(`_${language}_`);
          expect(filename).toContain(currentDate);
          expect(filename.endsWith(`.${expectedExtension}`)).toBe(true);

          if (scope === 'current') {
            expect(filename.startsWith('schedule_all-')).toBe(false);
            expect(filename.startsWith(`schedule_${type}_`)).toBe(true);
          } else {
            expect(filename.startsWith('schedule_all-')).toBe(true);
            expect(filename.startsWith(`schedule_all-${type}_`)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle edge cases in filename generation', () => {
    const edgeCaseNames = ['Class-A', 'Teacher_1', 'Grade10A'];
    edgeCaseNames.forEach((name) => {
      const filename = generateExportFilename('class', name, 'fa', 'pdf', 'current');
      expect(filename).toMatch(/^schedule_class_.*_fa_\d{4}-\d{2}-\d{2}\.pdf$/);
    });
  });

  it('should properly sanitize special characters', () => {
    const specialNames = ['Class/10A', 'Teacher@School', 'Grade 10 (A)'];
    specialNames.forEach((name) => {
      const filename = generateExportFilename('class', name, 'fa', 'pdf', 'current');
      expect(filename).not.toMatch(/[\/\\:*?"<>|]/);
      expect(filename).toMatch(/^schedule_class_.*_fa_\d{4}-\d{2}-\d{2}\.pdf$/);
    });
  });
});
