/**
 * Property-based tests for search filtering
 *
 * **Feature: classes-page, Property 1: Search Filtering Correctness**
 * **Validates: Requirements 1.2**
 *
 * Property 1: Search Filtering Correctness
 * *For any* class list and search term, all classes returned by the search filter
 * should contain the search term in at least one of: name, displayName, or
 * sectionIndex fields (case-insensitive).
 */

import * as fc from 'fast-check';
import { describe, it } from 'vitest';
import { filterClassesBySearch } from '../hooks/useClassFilters';
import type { ClassGroup } from '../types';

/**
 * Arbitrary for generating valid ClassGroup objects
 */
const classGroupArb: fc.Arbitrary<ClassGroup> = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  schoolId: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  academicYearId: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  displayName: fc.string({ maxLength: 100 }),
  section: fc.constantFrom('PRIMARY', 'MIDDLE', 'HIGH', '' as const),
  grade: fc.option(fc.integer({ min: 1, max: 12 }), { nil: null }),
  sectionIndex: fc.constantFrom('A', 'B', 'C', 'D', 'E', 'AB', 'ا', 'ب', 'ج', ''),
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

/**
 * Helper to check if a string contains another string (case-insensitive)
 */
function containsIgnoreCase(haystack: string | undefined | null, needle: string): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

describe('Search Filter Property Tests', () => {
  /**
   * **Feature: classes-page, Property 1: Search Filtering Correctness**
   * **Validates: Requirements 1.2**
   *
   * For any class list and non-empty search term (after trimming), all returned
   * classes should contain the search term in name, displayName, or sectionIndex
   */
  it('Property 1: All filtered classes contain the search term in at least one searchable field', () => {
    // Generate non-whitespace search terms to test actual filtering
    const nonWhitespaceSearchArb = fc
      .string({ minLength: 1, maxLength: 20 })
      .filter((s) => s.trim().length > 0);

    fc.assert(
      fc.property(
        fc.array(classGroupArb, { minLength: 0, maxLength: 50 }),
        nonWhitespaceSearchArb,
        (classes, searchTerm) => {
          const filtered = filterClassesBySearch(classes, searchTerm);
          const normalizedSearch = searchTerm.toLowerCase().trim();

          // Every filtered class should contain the search term in at least one field
          return filtered.every(
            (c) =>
              containsIgnoreCase(c.name, normalizedSearch) ||
              containsIgnoreCase(c.displayName, normalizedSearch) ||
              containsIgnoreCase(c.sectionIndex, normalizedSearch)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: classes-page, Property 1: Search Filtering Correctness**
   * **Validates: Requirements 1.2**
   *
   * Empty search term should return all classes
   */
  it('Property 1: Empty search term returns all classes', () => {
    fc.assert(
      fc.property(fc.array(classGroupArb, { minLength: 0, maxLength: 50 }), (classes) => {
        const filteredEmpty = filterClassesBySearch(classes, '');
        const filteredWhitespace = filterClassesBySearch(classes, '   ');

        return (
          filteredEmpty.length === classes.length && filteredWhitespace.length === classes.length
        );
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: classes-page, Property 1: Search Filtering Correctness**
   * **Validates: Requirements 1.2**
   *
   * Search is case-insensitive
   */
  it('Property 1: Search is case-insensitive', () => {
    fc.assert(
      fc.property(
        fc.array(classGroupArb, { minLength: 0, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        (classes, searchTerm) => {
          const lowerResult = filterClassesBySearch(classes, searchTerm.toLowerCase());
          const upperResult = filterClassesBySearch(classes, searchTerm.toUpperCase());
          const mixedResult = filterClassesBySearch(classes, searchTerm);

          // All variations should return the same results
          return (
            lowerResult.length === upperResult.length && upperResult.length === mixedResult.length
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: classes-page, Property 1: Search Filtering Correctness**
   * **Validates: Requirements 1.2**
   *
   * Filtered result is always a subset of the original
   */
  it('Property 1: Filtered result is a subset of original classes', () => {
    fc.assert(
      fc.property(
        fc.array(classGroupArb, { minLength: 0, maxLength: 50 }),
        fc.string({ maxLength: 20 }),
        (classes, searchTerm) => {
          const filtered = filterClassesBySearch(classes, searchTerm);

          // Filtered count should never exceed original count
          if (filtered.length > classes.length) return false;

          // Every filtered class should exist in the original array
          return filtered.every((fc) => classes.some((c) => c.id === fc.id));
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: classes-page, Property 1: Search Filtering Correctness**
   * **Validates: Requirements 1.2**
   *
   * If a class matches the search term, it should be in the result
   */
  it('Property 1: Classes matching the search term are included in results', () => {
    fc.assert(
      fc.property(
        fc.array(classGroupArb, { minLength: 1, maxLength: 50 }),
        fc.integer({ min: 0, max: 49 }),
        (classes, index) => {
          // Pick a class and use part of its name as search term
          const targetIndex = index % classes.length;
          const targetClass = classes[targetIndex];

          // Use the first 3 characters of the name (if available) as search term
          if (!targetClass.name || targetClass.name.length === 0) return true;

          const searchTerm = targetClass.name.substring(0, Math.min(3, targetClass.name.length));
          const filtered = filterClassesBySearch(classes, searchTerm);

          // The target class should be in the filtered results
          return filtered.some((c) => c.id === targetClass.id);
        }
      ),
      { numRuns: 100 }
    );
  });
});
