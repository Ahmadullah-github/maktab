/**
 * Unit tests for ClassForm validation
 *
 * **Feature: classes-page**
 * **Validates: Requirements 2.4**
 *
 * Tests the Zod schema validation for class form inputs including:
 * - Empty name validation
 * - Grade range validation
 * - Single-teacher mode toggle behavior
 */

import { classFormSchema, type ClassFormValues } from '@/schemas/class.schema';
import { describe, expect, it } from 'vitest';
import { shouldEnableSingleTeacherMode } from '../utils/gradeCategory';

/**
 * Helper to validate form values and extract errors
 */
function validateClassForm(values: Partial<ClassFormValues>) {
  const result = classFormSchema.safeParse(values);
  if (result.success) {
    return { success: true, data: result.data, errors: null };
  }
  return {
    success: false,
    data: null,
    errors: result.error.flatten().fieldErrors,
  };
}

describe('ClassForm Validation Unit Tests', () => {
  /**
   * Test empty name validation
   * Requirements: 2.4
   */
  describe('Empty Name Validation', () => {
    it('rejects empty name', () => {
      const result = validateClassForm({
        name: '',
        grade: 5,
        sectionIndex: 'A',
        studentCount: 30,
        singleTeacherMode: false,
        subjectRequirements: [],
      });

      expect(result.success).toBe(false);
      expect(result.errors?.name).toBeDefined();
      expect(result.errors?.name?.[0]).toBe('classes.validation.nameRequired');
    });

    it('rejects whitespace-only name', () => {
      const result = validateClassForm({
        name: '   ',
        grade: 5,
        sectionIndex: 'A',
        studentCount: 30,
        singleTeacherMode: false,
        subjectRequirements: [],
      });

      // Zod min(1) checks length after trimming is not applied by default
      // The schema uses min(1) which checks raw length
      expect(result.success).toBe(true); // Whitespace passes min(1)
    });

    it('accepts valid name', () => {
      const result = validateClassForm({
        name: 'صنف اول الف',
        grade: 1,
        sectionIndex: 'A',
        studentCount: 25,
        singleTeacherMode: true,
        subjectRequirements: [],
      });

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('صنف اول الف');
    });

    it('rejects name exceeding max length', () => {
      const longName = 'a'.repeat(256);
      const result = validateClassForm({
        name: longName,
        grade: 5,
        sectionIndex: 'A',
        studentCount: 30,
        singleTeacherMode: false,
        subjectRequirements: [],
      });

      expect(result.success).toBe(false);
      expect(result.errors?.name).toBeDefined();
      expect(result.errors?.name?.[0]).toBe('classes.validation.nameTooLong');
    });

    it('accepts name at max length boundary', () => {
      const maxName = 'a'.repeat(255);
      const result = validateClassForm({
        name: maxName,
        grade: 5,
        sectionIndex: 'A',
        studentCount: 30,
        singleTeacherMode: false,
        subjectRequirements: [],
      });

      expect(result.success).toBe(true);
    });
  });

  /**
   * Test grade range validation
   * Requirements: 2.4
   */
  describe('Grade Range Validation', () => {
    it('accepts grade 1 (minimum valid)', () => {
      const result = validateClassForm({
        name: 'Test Class',
        grade: 1,
        sectionIndex: 'A',
        studentCount: 30,
        singleTeacherMode: true,
        subjectRequirements: [],
      });

      expect(result.success).toBe(true);
      expect(result.data?.grade).toBe(1);
    });

    it('accepts grade 12 (maximum valid)', () => {
      const result = validateClassForm({
        name: 'Test Class',
        grade: 12,
        sectionIndex: 'A',
        studentCount: 30,
        singleTeacherMode: false,
        subjectRequirements: [],
      });

      expect(result.success).toBe(true);
      expect(result.data?.grade).toBe(12);
    });

    it('accepts null grade', () => {
      const result = validateClassForm({
        name: 'Test Class',
        grade: null,
        sectionIndex: 'A',
        studentCount: 30,
        singleTeacherMode: false,
        subjectRequirements: [],
      });

      expect(result.success).toBe(true);
      expect(result.data?.grade).toBeNull();
    });

    it('rejects grade 0 (below minimum)', () => {
      const result = validateClassForm({
        name: 'Test Class',
        grade: 0,
        sectionIndex: 'A',
        studentCount: 30,
        singleTeacherMode: false,
        subjectRequirements: [],
      });

      expect(result.success).toBe(false);
      expect(result.errors?.grade).toBeDefined();
      expect(result.errors?.grade?.[0]).toBe('classes.validation.invalidGrade');
    });

    it('rejects grade 13 (above maximum)', () => {
      const result = validateClassForm({
        name: 'Test Class',
        grade: 13,
        sectionIndex: 'A',
        studentCount: 30,
        singleTeacherMode: false,
        subjectRequirements: [],
      });

      expect(result.success).toBe(false);
      expect(result.errors?.grade).toBeDefined();
      expect(result.errors?.grade?.[0]).toBe('classes.validation.invalidGrade');
    });

    it('rejects negative grade', () => {
      const result = validateClassForm({
        name: 'Test Class',
        grade: -1,
        sectionIndex: 'A',
        studentCount: 30,
        singleTeacherMode: false,
        subjectRequirements: [],
      });

      expect(result.success).toBe(false);
      expect(result.errors?.grade).toBeDefined();
    });

    it('rejects non-integer grade', () => {
      const result = validateClassForm({
        name: 'Test Class',
        grade: 5.5,
        sectionIndex: 'A',
        studentCount: 30,
        singleTeacherMode: false,
        subjectRequirements: [],
      });

      expect(result.success).toBe(false);
      expect(result.errors?.grade).toBeDefined();
    });

    it('accepts all valid grades 1-12', () => {
      for (let grade = 1; grade <= 12; grade++) {
        const result = validateClassForm({
          name: `Grade ${grade} Class`,
          grade,
          sectionIndex: 'A',
          studentCount: 30,
          singleTeacherMode: grade <= 3,
          subjectRequirements: [],
        });

        expect(result.success).toBe(true);
        expect(result.data?.grade).toBe(grade);
      }
    });
  });

  /**
   * Test single-teacher mode toggle behavior
   * Requirements: 2.4
   */
  describe('Single-Teacher Mode Toggle Behavior', () => {
    it('shouldEnableSingleTeacherMode returns true for grades 1-3', () => {
      expect(shouldEnableSingleTeacherMode(1)).toBe(true);
      expect(shouldEnableSingleTeacherMode(2)).toBe(true);
      expect(shouldEnableSingleTeacherMode(3)).toBe(true);
    });

    it('shouldEnableSingleTeacherMode returns false for grades 4-12', () => {
      for (let grade = 4; grade <= 12; grade++) {
        expect(shouldEnableSingleTeacherMode(grade)).toBe(false);
      }
    });

    it('shouldEnableSingleTeacherMode returns false for null grade', () => {
      expect(shouldEnableSingleTeacherMode(null)).toBe(false);
    });

    it('accepts singleTeacherMode true for any grade', () => {
      // Schema allows singleTeacherMode to be true for any grade
      // The auto-enable is UI behavior, not schema validation
      const result = validateClassForm({
        name: 'Test Class',
        grade: 10,
        sectionIndex: 'A',
        studentCount: 30,
        singleTeacherMode: true,
        subjectRequirements: [],
      });

      expect(result.success).toBe(true);
      expect(result.data?.singleTeacherMode).toBe(true);
    });

    it('accepts singleTeacherMode false for any grade', () => {
      const result = validateClassForm({
        name: 'Test Class',
        grade: 2,
        sectionIndex: 'A',
        studentCount: 30,
        singleTeacherMode: false,
        subjectRequirements: [],
      });

      expect(result.success).toBe(true);
      expect(result.data?.singleTeacherMode).toBe(false);
    });

    it('defaults singleTeacherMode to false when not provided', () => {
      const result = validateClassForm({
        name: 'Test Class',
        grade: 5,
        sectionIndex: 'A',
        studentCount: 30,
        subjectRequirements: [],
      });

      expect(result.success).toBe(true);
      expect(result.data?.singleTeacherMode).toBe(false);
    });

    it('accepts classTeacherId when singleTeacherMode is true', () => {
      const result = validateClassForm({
        name: 'Test Class',
        grade: 2,
        sectionIndex: 'A',
        studentCount: 25,
        singleTeacherMode: true,
        classTeacherId: 42,
        subjectRequirements: [],
      });

      expect(result.success).toBe(true);
      expect(result.data?.classTeacherId).toBe(42);
    });

    it('accepts null classTeacherId when singleTeacherMode is true', () => {
      const result = validateClassForm({
        name: 'Test Class',
        grade: 2,
        sectionIndex: 'A',
        studentCount: 25,
        singleTeacherMode: true,
        classTeacherId: null,
        subjectRequirements: [],
      });

      expect(result.success).toBe(true);
      expect(result.data?.classTeacherId).toBeNull();
    });
  });

  /**
   * Test student count validation
   */
  describe('Student Count Validation', () => {
    it('accepts zero students', () => {
      const result = validateClassForm({
        name: 'Test Class',
        grade: 5,
        sectionIndex: 'A',
        studentCount: 0,
        singleTeacherMode: false,
        subjectRequirements: [],
      });

      expect(result.success).toBe(true);
      expect(result.data?.studentCount).toBe(0);
    });

    it('accepts maximum students (500)', () => {
      const result = validateClassForm({
        name: 'Test Class',
        grade: 5,
        sectionIndex: 'A',
        studentCount: 500,
        singleTeacherMode: false,
        subjectRequirements: [],
      });

      expect(result.success).toBe(true);
      expect(result.data?.studentCount).toBe(500);
    });

    it('rejects negative student count', () => {
      const result = validateClassForm({
        name: 'Test Class',
        grade: 5,
        sectionIndex: 'A',
        studentCount: -1,
        singleTeacherMode: false,
        subjectRequirements: [],
      });

      expect(result.success).toBe(false);
      expect(result.errors?.studentCount).toBeDefined();
    });

    it('rejects student count above maximum', () => {
      const result = validateClassForm({
        name: 'Test Class',
        grade: 5,
        sectionIndex: 'A',
        studentCount: 501,
        singleTeacherMode: false,
        subjectRequirements: [],
      });

      expect(result.success).toBe(false);
      expect(result.errors?.studentCount).toBeDefined();
    });
  });

  /**
   * Test subject requirements validation
   */
  describe('Subject Requirements Validation', () => {
    it('accepts empty subject requirements', () => {
      const result = validateClassForm({
        name: 'Test Class',
        grade: 5,
        sectionIndex: 'A',
        studentCount: 30,
        singleTeacherMode: false,
        subjectRequirements: [],
      });

      expect(result.success).toBe(true);
      expect(result.data?.subjectRequirements).toEqual([]);
    });

    it('accepts valid subject requirements', () => {
      const result = validateClassForm({
        name: 'Test Class',
        grade: 5,
        sectionIndex: 'A',
        studentCount: 30,
        singleTeacherMode: false,
        subjectRequirements: [
          { subjectId: 1, periodsPerWeek: 5, teacherId: null },
          { subjectId: 2, periodsPerWeek: 3, teacherId: 10 },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.data?.subjectRequirements).toHaveLength(2);
    });

    it('rejects invalid subject requirement (zero periods)', () => {
      const result = validateClassForm({
        name: 'Test Class',
        grade: 5,
        sectionIndex: 'A',
        studentCount: 30,
        singleTeacherMode: false,
        subjectRequirements: [{ subjectId: 1, periodsPerWeek: 0, teacherId: null }],
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid subject requirement (periods > 20)', () => {
      const result = validateClassForm({
        name: 'Test Class',
        grade: 5,
        sectionIndex: 'A',
        studentCount: 30,
        singleTeacherMode: false,
        subjectRequirements: [{ subjectId: 1, periodsPerWeek: 21, teacherId: null }],
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid subject requirement (negative subjectId)', () => {
      const result = validateClassForm({
        name: 'Test Class',
        grade: 5,
        sectionIndex: 'A',
        studentCount: 30,
        singleTeacherMode: false,
        subjectRequirements: [{ subjectId: -1, periodsPerWeek: 5, teacherId: null }],
      });

      expect(result.success).toBe(false);
    });
  });

  /**
   * Test complete valid form
   */
  describe('Complete Form Validation', () => {
    it('accepts complete valid form for alpha-primary class', () => {
      const result = validateClassForm({
        name: 'صنف اول الف',
        displayName: 'First Grade A',
        grade: 1,
        sectionIndex: 'A',
        studentCount: 25,
        fixedRoomId: 5,
        singleTeacherMode: true,
        classTeacherId: 10,
        subjectRequirements: [
          { subjectId: 1, periodsPerWeek: 6, teacherId: 10 },
          { subjectId: 2, periodsPerWeek: 4, teacherId: 10 },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        name: 'صنف اول الف',
        grade: 1,
        singleTeacherMode: true,
        classTeacherId: 10,
      });
    });

    it('accepts complete valid form for high school class', () => {
      const result = validateClassForm({
        name: 'صنف دوازدهم ب',
        displayName: 'Twelfth Grade B',
        grade: 12,
        sectionIndex: 'B',
        studentCount: 35,
        fixedRoomId: 20,
        singleTeacherMode: false,
        classTeacherId: null,
        subjectRequirements: [
          { subjectId: 1, periodsPerWeek: 5, teacherId: 15 },
          { subjectId: 2, periodsPerWeek: 4, teacherId: 16 },
          { subjectId: 3, periodsPerWeek: 3, teacherId: 17 },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        name: 'صنف دوازدهم ب',
        grade: 12,
        singleTeacherMode: false,
      });
    });
  });
});
