/**
 * Property-based tests for grade category filtering
 *
 * **Feature: classes-page, Property 2: Grade Category Filtering Correctness**
 * **Validates: Requirements 1.3, 5.2**
 */

import * as fc from 'fast-check';
import { describe, it } from 'vitest';
import { filterClassesByGradeCategory } from '../hooks/useClassFilters';
import type { ClassGroup, GradeCategory } from '../types';
import { getGradeCategory } from '../utils/gradeCategory';

const classGroupArb: fc.Arbitrary<ClassGroup> = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  schoolId: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  academicYearId: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  displayName: fc.string({ maxLength: 100 }),
  section: fc.constantFrom('PRIMARY', 'MIDDLE', 'HIGH', '' as const),
  grade: fc.option(fc.integer({ min: 1, max: 12 }), { nil: null }),
  sectionIndex: fc.constantFrom('A', 'B', 'C', 'D', 'E', 'AB'),
  studentCount: fc.integer({ min: 0, max: 500 }),
  fixedRoomId: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  singleTeacherMode: fc.boolean(),
  classTeacherId: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  subjectRequirements: fc.array(
    fc.record({
      subjectId: fc.integer({ min: 1, max: 100 }),
      periodsPerWeek: fc.integer({ min: 1, max: 20 }),
      teacherId: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
    }),
    { maxLength: 10 }
  ),
  meta: fc.constant({}),
  isDeleted: fc.constant(false),
  deletedAt: fc.constant(null),
  createdAt: fc.constant(new Date().toISOString()),
  updatedAt: fc.constant(new Date().toISOString()),
});

const specificGradeCategoryArb: fc.Arbitrary<GradeCategory> = fc.constantFrom(
  'alphaPrimary',
  'betaPrimary',
  'middle',
  'high'
);

const gradeCategoryArb: fc.Arbitrary<GradeCategory> = fc.constantFrom(
  'all',
  'alphaPrimary',
  'betaPrimary',
  'middle',
  'high'
);

function isGradeInExpectedRange(grade: number | null, category: GradeCategory): boolean {
  if (category === 'all') return true;
  if (grade === null) return false;
  switch (category) {
    case 'alphaPrimary':
      return grade >= 1 && grade <= 3;
    case 'betaPrimary':
      return grade >= 4 && grade <= 6;
    case 'middle':
      return grade >= 7 && grade <= 9;
    case 'high':
      return grade >= 10 && grade <= 12;
    default:
      return false;
  }
}

describe('Grade Category Filter Property Tests', () => {
  it('Property 2: All filtered classes have grades within the selected category range', () => {
    fc.assert(
      fc.property(
        fc.array(classGroupArb, { minLength: 0, maxLength: 50 }),
        specificGradeCategoryArb,
        (classes, category) => {
          const filtered = filterClassesByGradeCategory(classes, category);
          return filtered.every((c) => isGradeInExpectedRange(c.grade, category));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2a: "all" category returns all classes', () => {
    fc.assert(
      fc.property(fc.array(classGroupArb, { minLength: 0, maxLength: 50 }), (classes) => {
        const filtered = filterClassesByGradeCategory(classes, 'all');
        return filtered.length === classes.length;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 2b: Filtering preserves class data integrity', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(classGroupArb, { minLength: 1, maxLength: 50, selector: (c) => c.id }),
        gradeCategoryArb,
        (classes, category) => {
          const filtered = filterClassesByGradeCategory(classes, category);
          return filtered.every((filteredClass) => {
            const original = classes.find((c) => c.id === filteredClass.id);
            return (
              original !== undefined && JSON.stringify(original) === JSON.stringify(filteredClass)
            );
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2c: Filtered classes are a subset of original classes', () => {
    fc.assert(
      fc.property(
        fc.array(classGroupArb, { minLength: 0, maxLength: 50 }),
        gradeCategoryArb,
        (classes, category) => {
          const filtered = filterClassesByGradeCategory(classes, category);
          return filtered.length <= classes.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2d: getGradeCategory is consistent with filter behavior', () => {
    fc.assert(
      fc.property(
        fc.array(classGroupArb, { minLength: 0, maxLength: 50 }),
        specificGradeCategoryArb,
        (classes, category) => {
          const filtered = filterClassesByGradeCategory(classes, category);
          return filtered.every((c) => getGradeCategory(c.grade) === category);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2e: Classes with null grade are excluded from specific category filters', () => {
    fc.assert(
      fc.property(
        fc.array(classGroupArb, { minLength: 0, maxLength: 50 }),
        specificGradeCategoryArb,
        (classes, category) => {
          const filtered = filterClassesByGradeCategory(classes, category);
          return filtered.every((c) => c.grade !== null);
        }
      ),
      { numRuns: 100 }
    );
  });
});
