/**
 * Property-based tests for Teacher name validation
 *
 * Feature: teachers-feature, Property 3: Teacher name validation rejects invalid inputs
 * Validates: Requirements 2.2, 2.3
 */

import { TEACHER_NAME_MAX_LENGTH, teacherFormSchema } from '@/schemas/teacher.schema';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

describe('Teacher Name Validation Property Tests', () => {
  /**
   * Feature: teachers-feature, Property 3: Teacher name validation rejects invalid inputs
   *
   * For any string that is empty or composed entirely of whitespace characters,
   * the validation schema SHALL reject it.
   * For any string exceeding the maximum allowed length, the validation schema SHALL reject it.
   *
   * Validates: Requirements 2.2, 2.3
   */
  describe('Property 3: Teacher name validation rejects invalid inputs', () => {
    /**
     * Generator for whitespace-only strings
     * Generates strings composed entirely of whitespace characters (spaces, tabs, newlines)
     */
    const whitespaceOnlyArbitrary = fc
      .array(fc.constantFrom(' ', '\t', '\n', '\r', '\f', '\v'), { minLength: 0, maxLength: 50 })
      .map((chars) => chars.join(''));

    /**
     * Generator for valid non-empty names
     * Generates strings with at least one non-whitespace character
     */
    const validNameArbitrary = fc
      .string({ minLength: 1, maxLength: TEACHER_NAME_MAX_LENGTH })
      .filter((s) => s.trim().length > 0);

    /**
     * Generator for strings exceeding max length
     */
    const tooLongNameArbitrary = fc.string({
      minLength: TEACHER_NAME_MAX_LENGTH + 1,
      maxLength: TEACHER_NAME_MAX_LENGTH + 100,
    });

    it('should reject empty strings', () => {
      const result = teacherFormSchema.safeParse({ fullName: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.includes('fullName'))).toBe(true);
      }
    });

    it('should reject whitespace-only strings', () => {
      fc.assert(
        fc.property(whitespaceOnlyArbitrary, (whitespaceString) => {
          const result = teacherFormSchema.safeParse({ fullName: whitespaceString });
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.includes('fullName'))).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should reject strings exceeding maximum length', () => {
      fc.assert(
        fc.property(tooLongNameArbitrary, (longString) => {
          const result = teacherFormSchema.safeParse({ fullName: longString });
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.includes('fullName'))).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should accept valid non-empty names within length limit', () => {
      fc.assert(
        fc.property(validNameArbitrary, (validName) => {
          const result = teacherFormSchema.safeParse({ fullName: validName });
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should accept names at exactly the maximum length', () => {
      const maxLengthName = 'a'.repeat(TEACHER_NAME_MAX_LENGTH);
      const result = teacherFormSchema.safeParse({ fullName: maxLengthName });
      expect(result.success).toBe(true);
    });

    it('should reject names at exactly max length + 1', () => {
      const tooLongName = 'a'.repeat(TEACHER_NAME_MAX_LENGTH + 1);
      const result = teacherFormSchema.safeParse({ fullName: tooLongName });
      expect(result.success).toBe(false);
    });

    it('should accept names with leading/trailing whitespace if they contain non-whitespace', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.string({ minLength: 0, maxLength: 10 }).map((s) => s.replace(/\S/g, ' ')), // leading whitespace
            fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0), // core name
            fc.string({ minLength: 0, maxLength: 10 }).map((s) => s.replace(/\S/g, ' ')) // trailing whitespace
          ),
          ([leading, core, trailing]) => {
            const nameWithWhitespace = leading + core + trailing;
            // Only test if within max length
            if (nameWithWhitespace.length <= TEACHER_NAME_MAX_LENGTH) {
              const result = teacherFormSchema.safeParse({ fullName: nameWithWhitespace });
              expect(result.success).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
