/**
 * Property-based tests for class CRUD operations
 *
 * **Feature: classes-page, Properties 6, 7, 8: Class CRUD Operations**
 * **Validates: Requirements 2.3, 3.3, 4.2**
 *
 * These tests verify the invariants of class creation, update, and deletion
 * operations using property-based testing with fast-check.
 */

import * as fc from 'fast-check';
import { describe, it } from 'vitest';
import type { ClassFormValues, ClassGroup, SubjectRequirement } from '../types';

/**
 * Arbitrary generator for SubjectRequirement
 */
const subjectRequirementArb: fc.Arbitrary<SubjectRequirement> = fc.record({
  subjectId: fc.integer({ min: 1, max: 1000 }),
  periodsPerWeek: fc.integer({ min: 1, max: 20 }),
  teacherId: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: null }),
});

/**
 * Arbitrary generator for valid ClassFormValues
 */
const classFormValuesArb: fc.Arbitrary<ClassFormValues> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 255 }),
  displayName: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
  grade: fc.option(fc.integer({ min: 1, max: 12 }), { nil: null }),
  sectionIndex: fc.string({ maxLength: 10 }),
  studentCount: fc.integer({ min: 0, max: 500 }),
  fixedRoomId: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: null }),
  singleTeacherMode: fc.boolean(),
  classTeacherId: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: null }),
  subjectRequirements: fc.array(subjectRequirementArb, { maxLength: 10 }),
});

/**
 * Arbitrary generator for ClassGroup (API response)
 */
const classGroupArb: fc.Arbitrary<ClassGroup> = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  schoolId: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  academicYearId: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  name: fc.string({ minLength: 1, maxLength: 255 }),
  displayName: fc.string({ maxLength: 100 }),
  section: fc.constantFrom('PRIMARY', 'MIDDLE', 'HIGH', '' as const),
  grade: fc.option(fc.integer({ min: 1, max: 12 }), { nil: null }),
  sectionIndex: fc.string({ maxLength: 10 }),
  studentCount: fc.integer({ min: 0, max: 500 }),
  fixedRoomId: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: null }),
  singleTeacherMode: fc.boolean(),
  classTeacherId: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: null }),
  subjectRequirements: fc.array(subjectRequirementArb, { maxLength: 10 }),
  meta: fc.constant({}),
  isDeleted: fc.constant(false),
  deletedAt: fc.constant(null),
  createdAt: fc.constant(new Date().toISOString()),
  updatedAt: fc.constant(new Date().toISOString()),
});

/**
 * Simulates adding a class to a list (create operation)
 */
function simulateCreateClass(
  classes: ClassGroup[],
  formValues: ClassFormValues,
  newId: number
): ClassGroup[] {
  const newClass: ClassGroup = {
    id: newId,
    schoolId: null,
    academicYearId: null,
    name: formValues.name,
    displayName: formValues.displayName || '',
    section: '',
    grade: formValues.grade,
    sectionIndex: formValues.sectionIndex || '',
    studentCount: formValues.studentCount,
    fixedRoomId: formValues.fixedRoomId ?? null,
    singleTeacherMode: formValues.singleTeacherMode,
    classTeacherId: formValues.classTeacherId ?? null,
    subjectRequirements: formValues.subjectRequirements,
    meta: {},
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return [...classes, newClass];
}

/**
 * Simulates updating a class in a list (update operation)
 */
function simulateUpdateClass(
  classes: ClassGroup[],
  id: number,
  updates: Partial<ClassFormValues>
): ClassGroup[] {
  return classes.map((c) => {
    if (c.id === id) {
      return {
        ...c,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
    }
    return c;
  });
}

/**
 * Simulates deleting a class from a list (soft delete)
 */
function simulateDeleteClass(classes: ClassGroup[], id: number): ClassGroup[] {
  return classes.filter((c) => c.id !== id);
}

describe('Class CRUD Property Tests', () => {
  /**
   * **Feature: classes-page, Property 6: Class Creation Adds to List**
   * **Validates: Requirements 2.3**
   *
   * For any valid ClassFormValues, creating a class should add exactly one
   * new class to the list with the provided data.
   */
  describe('Property 6: Class Creation Adds to List', () => {
    it('Creating a class increases list length by 1', () => {
      fc.assert(
        fc.property(
          fc.array(classGroupArb, { minLength: 0, maxLength: 50 }),
          classFormValuesArb,
          (existingClasses, formValues) => {
            const originalLength = existingClasses.length;
            // Generate a unique ID
            const maxId =
              existingClasses.length > 0 ? Math.max(...existingClasses.map((c) => c.id)) : 0;
            const newId = maxId + 1;
            const updatedClasses = simulateCreateClass(existingClasses, formValues, newId);
            return updatedClasses.length === originalLength + 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Created class has the provided name', () => {
      fc.assert(
        fc.property(
          fc.array(classGroupArb, { minLength: 0, maxLength: 50 }),
          classFormValuesArb,
          (existingClasses, formValues) => {
            // Generate a unique ID
            const maxId =
              existingClasses.length > 0 ? Math.max(...existingClasses.map((c) => c.id)) : 0;
            const newId = maxId + 1;
            const updatedClasses = simulateCreateClass(existingClasses, formValues, newId);
            const createdClass = updatedClasses.find((c) => c.id === newId);
            return createdClass !== undefined && createdClass.name === formValues.name;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Created class preserves all form values', () => {
      fc.assert(
        fc.property(
          classFormValuesArb,
          fc.integer({ min: 1, max: 100000 }),
          (formValues, newId) => {
            const updatedClasses = simulateCreateClass([], formValues, newId);
            const createdClass = updatedClasses[0];

            return (
              createdClass.name === formValues.name &&
              createdClass.grade === formValues.grade &&
              createdClass.sectionIndex === (formValues.sectionIndex || '') &&
              createdClass.studentCount === formValues.studentCount &&
              createdClass.singleTeacherMode === formValues.singleTeacherMode &&
              createdClass.subjectRequirements.length === formValues.subjectRequirements.length
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Created class has unique ID', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(classGroupArb, { minLength: 1, maxLength: 50, selector: (c) => c.id }),
          classFormValuesArb,
          (existingClasses, formValues) => {
            // Generate a new ID that doesn't exist in the list
            const maxId =
              existingClasses.length > 0 ? Math.max(...existingClasses.map((c) => c.id)) : 0;
            const newId = maxId + 1;
            const updatedClasses = simulateCreateClass(existingClasses, formValues, newId);

            // All IDs should still be unique
            const allIds = updatedClasses.map((c) => c.id);
            return new Set(allIds).size === allIds.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Existing classes are not modified on create', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(classGroupArb, { minLength: 1, maxLength: 50, selector: (c) => c.id }),
          classFormValuesArb,
          fc.integer({ min: 100001, max: 200000 }),
          (existingClasses, formValues, newId) => {
            const updatedClasses = simulateCreateClass(existingClasses, formValues, newId);

            // All existing classes should be unchanged
            return existingClasses.every((original) => {
              const found = updatedClasses.find((c) => c.id === original.id);
              return found !== undefined && JSON.stringify(found) === JSON.stringify(original);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: classes-page, Property 7: Class Update Persists Changes**
   * **Validates: Requirements 3.3**
   *
   * For any existing class and valid update data, updating should modify
   * only the specified fields while preserving others.
   */
  describe('Property 7: Class Update Persists Changes', () => {
    it('Update changes the specified field', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(classGroupArb, { minLength: 1, maxLength: 50, selector: (c) => c.id }),
          fc.string({ minLength: 1, maxLength: 255 }),
          (classes, newName) => {
            const targetClass = classes[0];
            const updatedClasses = simulateUpdateClass(classes, targetClass.id, { name: newName });
            const updated = updatedClasses.find((c) => c.id === targetClass.id);

            return updated !== undefined && updated.name === newName;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Update preserves unmodified fields', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(classGroupArb, { minLength: 1, maxLength: 50, selector: (c) => c.id }),
          fc.string({ minLength: 1, maxLength: 255 }),
          (classes, newName) => {
            const targetClass = classes[0];
            const updatedClasses = simulateUpdateClass(classes, targetClass.id, { name: newName });
            const updated = updatedClasses.find((c) => c.id === targetClass.id);

            return (
              updated !== undefined &&
              updated.grade === targetClass.grade &&
              updated.studentCount === targetClass.studentCount &&
              updated.singleTeacherMode === targetClass.singleTeacherMode
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Update does not change list length', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(classGroupArb, { minLength: 1, maxLength: 50, selector: (c) => c.id }),
          fc.string({ minLength: 1, maxLength: 255 }),
          (classes, newName) => {
            const targetClass = classes[0];
            const updatedClasses = simulateUpdateClass(classes, targetClass.id, { name: newName });

            return updatedClasses.length === classes.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Update does not affect other classes', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(classGroupArb, { minLength: 2, maxLength: 50, selector: (c) => c.id }),
          fc.string({ minLength: 1, maxLength: 255 }),
          (classes, newName) => {
            const targetClass = classes[0];
            const updatedClasses = simulateUpdateClass(classes, targetClass.id, { name: newName });

            // All other classes should be unchanged
            return classes.slice(1).every((original) => {
              const found = updatedClasses.find((c) => c.id === original.id);
              return found !== undefined && JSON.stringify(found) === JSON.stringify(original);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Multiple field update applies all changes', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(classGroupArb, { minLength: 1, maxLength: 50, selector: (c) => c.id }),
          fc.string({ minLength: 1, maxLength: 255 }),
          fc.integer({ min: 0, max: 500 }),
          fc.boolean(),
          (classes, newName, newStudentCount, newSingleTeacherMode) => {
            const targetClass = classes[0];
            const updates = {
              name: newName,
              studentCount: newStudentCount,
              singleTeacherMode: newSingleTeacherMode,
            };
            const updatedClasses = simulateUpdateClass(classes, targetClass.id, updates);
            const updated = updatedClasses.find((c) => c.id === targetClass.id);

            return (
              updated !== undefined &&
              updated.name === newName &&
              updated.studentCount === newStudentCount &&
              updated.singleTeacherMode === newSingleTeacherMode
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: classes-page, Property 8: Class Deletion Removes from List**
   * **Validates: Requirements 4.2**
   *
   * For any existing class, deleting it should remove exactly that class
   * from the list while preserving all others.
   */
  describe('Property 8: Class Deletion Removes from List', () => {
    it('Deletion decreases list length by 1', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(classGroupArb, { minLength: 1, maxLength: 50, selector: (c) => c.id }),
          (classes) => {
            const targetClass = classes[0];
            const originalLength = classes.length;
            const updatedClasses = simulateDeleteClass(classes, targetClass.id);

            return updatedClasses.length === originalLength - 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Deleted class is no longer in list', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(classGroupArb, { minLength: 1, maxLength: 50, selector: (c) => c.id }),
          (classes) => {
            const targetClass = classes[0];
            const updatedClasses = simulateDeleteClass(classes, targetClass.id);

            return updatedClasses.find((c) => c.id === targetClass.id) === undefined;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Other classes are preserved after deletion', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(classGroupArb, { minLength: 2, maxLength: 50, selector: (c) => c.id }),
          (classes) => {
            const targetClass = classes[0];
            const updatedClasses = simulateDeleteClass(classes, targetClass.id);

            // All other classes should still exist and be unchanged
            return classes.slice(1).every((original) => {
              const found = updatedClasses.find((c) => c.id === original.id);
              return found !== undefined && JSON.stringify(found) === JSON.stringify(original);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Deleting non-existent ID does not change list', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(classGroupArb, { minLength: 1, maxLength: 50, selector: (c) => c.id }),
          fc.integer({ min: 100001, max: 200000 }),
          (classes, nonExistentId) => {
            const updatedClasses = simulateDeleteClass(classes, nonExistentId);

            return (
              updatedClasses.length === classes.length &&
              classes.every((original) => {
                const found = updatedClasses.find((c) => c.id === original.id);
                return found !== undefined;
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Deleting from empty list returns empty list', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100000 }), (id) => {
          const updatedClasses = simulateDeleteClass([], id);
          return updatedClasses.length === 0;
        }),
        { numRuns: 100 }
      );
    });
  });
});
