/**
 * Property-based tests for grade category utility functions
 *
 * **Feature: classes-page, Property 4: Grade Category Classification**
 * **Validates: Requirements 5.3, 5.4**
 *
 * Property 4: Grade Category Classification
 * *For any* valid grade (1-12), the `getGradeCategory` function should return
 * the correct category: alphaPrimary for 1-3, betaPrimary for 4-6, middle for 7-9,
 * high for 10-12.
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { GradeCategory } from '../types';
import { getGradeCategory, GRADE_CATEGORY_COLORS, isGradeInCategory } from '../utils/gradeCategory';

describe('Grade Category Property Tests', () => {
  /**
   * **Feature: classes-page, Property 4: Grade Category Classification**
   * **Validates: Requirements 5.3, 5.4**
   *
   * For any grade in range 1-3, getGradeCategory should return 'alphaPrimary'
   */
  it('Property 4: Grades 1-3 are classified as alphaPrimary', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 3 }), (grade) => {
        return getGradeCategory(grade) === 'alphaPrimary';
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: classes-page, Property 4: Grade Category Classification**
   * **Validates: Requirements 5.3, 5.4**
   *
   * For any grade in range 4-6, getGradeCategory should return 'betaPrimary'
   */
  it('Property 4: Grades 4-6 are classified as betaPrimary', () => {
    fc.assert(
      fc.property(fc.integer({ min: 4, max: 6 }), (grade) => {
        return getGradeCategory(grade) === 'betaPrimary';
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: classes-page, Property 4: Grade Category Classification**
   * **Validates: Requirements 5.3, 5.4**
   *
   * For any grade in range 7-9, getGradeCategory should return 'middle'
   */
  it('Property 4: Grades 7-9 are classified as middle', () => {
    fc.assert(
      fc.property(fc.integer({ min: 7, max: 9 }), (grade) => {
        return getGradeCategory(grade) === 'middle';
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: classes-page, Property 4: Grade Category Classification**
   * **Validates: Requirements 5.3, 5.4**
   *
   * For any grade in range 10-12, getGradeCategory should return 'high'
   */
  it('Property 4: Grades 10-12 are classified as high', () => {
    fc.assert(
      fc.property(fc.integer({ min: 10, max: 12 }), (grade) => {
        return getGradeCategory(grade) === 'high';
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: classes-page, Property 4: Grade Category Classification**
   * **Validates: Requirements 5.3, 5.4**
   *
   * For null grade, getGradeCategory should return 'all'
   */
  it('Property 4: Null grade returns all category', () => {
    expect(getGradeCategory(null)).toBe('all');
  });

  /**
   * **Feature: classes-page, Property 4: Grade Category Classification**
   * **Validates: Requirements 5.3, 5.4**
   *
   * For any valid grade (1-12), the category should have a corresponding color
   */
  it('Property 4: Every valid grade has a category with defined color', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 12 }), (grade) => {
        const category = getGradeCategory(grade);
        return category in GRADE_CATEGORY_COLORS;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: classes-page, Property 4: Grade Category Classification**
   * **Validates: Requirements 5.2**
   *
   * isGradeInCategory with 'all' should always return true for any grade
   */
  it('Property 4: All category matches any grade', () => {
    fc.assert(
      fc.property(fc.option(fc.integer({ min: 1, max: 12 }), { nil: null }), (grade) => {
        return isGradeInCategory(grade, 'all') === true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: classes-page, Property 4: Grade Category Classification**
   * **Validates: Requirements 5.2**
   *
   * isGradeInCategory should be consistent with getGradeCategory
   */
  it('Property 4: isGradeInCategory is consistent with getGradeCategory', () => {
    const categories: GradeCategory[] = ['alphaPrimary', 'betaPrimary', 'middle', 'high'];

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.constantFrom(...categories),
        (grade, category) => {
          const gradeCategory = getGradeCategory(grade);
          const isInCategory = isGradeInCategory(grade, category);

          // If the grade's category matches, isGradeInCategory should return true
          // Otherwise, it should return false
          return isInCategory === (gradeCategory === category);
        }
      ),
      { numRuns: 100 }
    );
  });
});
