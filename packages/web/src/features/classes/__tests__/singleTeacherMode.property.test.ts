/**
 * Property-based tests for single-teacher mode auto-enable
 *
 * **Feature: classes-page, Property 3: Single-Teacher Mode Auto-Enable**
 * **Validates: Requirements 2.5, 5.4**
 *
 * Property 3: Single-Teacher Mode Auto-Enable
 * *For any* grade value between 1 and 3 (inclusive), the
 * `shouldEnableSingleTeacherMode` function should return true; for any grade
 * outside this range or null, it should return false.
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { shouldEnableSingleTeacherMode } from '../utils/gradeCategory';

describe('Single-Teacher Mode Property Tests', () => {
  /**
   * **Feature: classes-page, Property 3: Single-Teacher Mode Auto-Enable**
   * **Validates: Requirements 2.5, 5.4**
   *
   * For any grade in range 1-3, shouldEnableSingleTeacherMode should return true
   */
  it('Property 3: Grades 1-3 should enable single-teacher mode', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 3 }), (grade) => {
        return shouldEnableSingleTeacherMode(grade) === true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: classes-page, Property 3: Single-Teacher Mode Auto-Enable**
   * **Validates: Requirements 2.5, 5.4**
   *
   * For any grade in range 4-12, shouldEnableSingleTeacherMode should return false
   */
  it('Property 3: Grades 4-12 should not enable single-teacher mode', () => {
    fc.assert(
      fc.property(fc.integer({ min: 4, max: 12 }), (grade) => {
        return shouldEnableSingleTeacherMode(grade) === false;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: classes-page, Property 3: Single-Teacher Mode Auto-Enable**
   * **Validates: Requirements 2.5, 5.4**
   *
   * For null grade, shouldEnableSingleTeacherMode should return false
   */
  it('Property 3: Null grade should not enable single-teacher mode', () => {
    expect(shouldEnableSingleTeacherMode(null)).toBe(false);
  });

  /**
   * **Feature: classes-page, Property 3: Single-Teacher Mode Auto-Enable**
   * **Validates: Requirements 2.5, 5.4**
   *
   * For any grade outside valid range (< 1 or > 12), shouldEnableSingleTeacherMode
   * should return false
   */
  it('Property 3: Invalid grades should not enable single-teacher mode', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer({ min: -100, max: 0 }), fc.integer({ min: 13, max: 100 })),
        (grade) => {
          return shouldEnableSingleTeacherMode(grade) === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: classes-page, Property 3: Single-Teacher Mode Auto-Enable**
   * **Validates: Requirements 2.5, 5.4**
   *
   * The function should be deterministic - same input always produces same output
   */
  it('Property 3: Function is deterministic', () => {
    fc.assert(
      fc.property(fc.option(fc.integer({ min: 1, max: 12 }), { nil: null }), (grade) => {
        const result1 = shouldEnableSingleTeacherMode(grade);
        const result2 = shouldEnableSingleTeacherMode(grade);
        return result1 === result2;
      }),
      { numRuns: 100 }
    );
  });
});
