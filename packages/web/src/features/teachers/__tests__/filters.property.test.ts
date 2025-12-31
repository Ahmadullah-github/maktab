/**
 * Property-based tests for Teachers filter functions
 *
 * Feature: teachers-feature, Property 1: Search filter returns matching teachers
 * Feature: teachers-feature, Property 2: Status filter returns correct employment type
 * Validates: Requirements 1.2, 1.3
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  applyTeacherFilters,
  filterTeachersBySearch,
  filterTeachersByStatus,
  isTeacherFullTime,
} from '../hooks/useTeacherFilters';
import type { Teacher, TeacherFiltersState } from '../types';

/**
 * Generator for a minimal Teacher object with required fields for filtering
 * Note: id is generated separately to ensure uniqueness when creating arrays
 */
const teacherArbitraryWithId = (id: number): fc.Arbitrary<Teacher> =>
  fc.record({
    id: fc.constant(id),
    schoolId: fc.constant(null as number | null),
    fullName: fc.string({ minLength: 1, maxLength: 100 }),
    primarySubjectIds: fc.constant([] as number[]),
    allowedSubjectIds: fc.constant([] as number[]),
    restrictToPrimarySubjects: fc.constant(false),
    availability: fc.constant([] as boolean[][]),
    unavailable: fc.constant([] as { day: number; period: number }[]),
    maxPeriodsPerWeek: fc.integer({ min: 1, max: 42 }),
    maxPeriodsPerDay: fc.integer({ min: 1, max: 10 }),
    maxConsecutivePeriods: fc.constantFrom(1, 2),
    timePreference: fc.constantFrom('morning' as const, 'afternoon' as const, 'any' as const),
    preferredRoomIds: fc.constant([] as number[]),
    preferredColleagues: fc.constant([] as number[]),
    classAssignments: fc.constant([] as { subjectId: number; classIds: number[] }[]),
    meta: fc.constant({} as Record<string, unknown>),
    isDeleted: fc.constant(false),
    deletedAt: fc.constant(null as string | null),
    createdAt: fc.constant('2024-01-01T00:00:00Z'),
    updatedAt: fc.constant('2024-01-01T00:00:00Z'),
  });

/**
 * Generator for a single teacher (used in single-teacher tests)
 */
const teacherArbitrary: fc.Arbitrary<Teacher> = fc
  .integer({ min: 1, max: 10000 })
  .chain((id) => teacherArbitraryWithId(id));

/**
 * Generator for an array of teachers with unique IDs
 * This ensures no duplicate IDs which is required for partition tests
 */
const uniqueTeachersArbitrary = (maxLength: number): fc.Arbitrary<Teacher[]> =>
  fc
    .integer({ min: 0, max: maxLength })
    .chain((length) => fc.tuple(...Array.from({ length }, (_, i) => teacherArbitraryWithId(i + 1))))
    .map((teachers) => teachers as Teacher[]);

describe('Filter Property Tests', () => {
  /**
   * Feature: teachers-feature, Property 1: Search filter returns matching teachers
   * For any teacher list and any non-empty search term, all teachers returned by
   * the search filter SHALL have their fullName field containing the search term
   * (case-insensitive).
   * Validates: Requirements 1.2
   */
  describe('Property 1: Search filter returns matching teachers', () => {
    it('all returned teachers should have fullName containing the search term (case-insensitive)', () => {
      fc.assert(
        fc.property(
          fc.array(teacherArbitrary, { minLength: 0, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          (teachers: Teacher[], searchTerm: string) => {
            const filtered = filterTeachersBySearch(teachers, searchTerm);
            const normalizedSearch = searchTerm.toLowerCase().trim();

            // All returned teachers must have fullName containing the search term
            for (const teacher of filtered) {
              const fullNameLower = teacher.fullName.toLowerCase();
              expect(fullNameLower).toContain(normalizedSearch);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not exclude any teacher whose fullName contains the search term', () => {
      fc.assert(
        fc.property(
          fc.array(teacherArbitrary, { minLength: 0, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          (teachers: Teacher[], searchTerm: string) => {
            const filtered = filterTeachersBySearch(teachers, searchTerm);
            const normalizedSearch = searchTerm.toLowerCase().trim();

            // Count teachers that should match
            const expectedMatches = teachers.filter((t) =>
              t.fullName.toLowerCase().includes(normalizedSearch)
            );

            expect(filtered.length).toBe(expectedMatches.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('empty search term should return all teachers', () => {
      fc.assert(
        fc.property(
          fc.array(teacherArbitrary, { minLength: 0, maxLength: 20 }),
          (teachers: Teacher[]) => {
            const filteredEmpty = filterTeachersBySearch(teachers, '');
            const filteredWhitespace = filterTeachersBySearch(teachers, '   ');

            expect(filteredEmpty).toEqual(teachers);
            expect(filteredWhitespace).toEqual(teachers);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: teachers-feature, Property 2: Status filter returns correct employment type
   * For any teacher list and any status filter value (fullTime, partTime), all
   * teachers returned by the filter SHALL match the selected employment type based
   * on their maxPeriodsPerWeek relative to SchoolConfig limits.
   * Validates: Requirements 1.3
   */
  describe('Property 2: Status filter returns correct employment type', () => {
    // Full-time threshold is 80% of max periods
    const FULL_TIME_THRESHOLD = 0.8;

    it('fullTime filter should only return teachers with maxPeriodsPerWeek >= 80% of max', () => {
      fc.assert(
        fc.property(
          fc.array(teacherArbitrary, { minLength: 0, maxLength: 20 }),
          fc.integer({ min: 10, max: 60 }), // maxPossiblePeriodsPerWeek
          (teachers: Teacher[], maxPossiblePeriodsPerWeek: number) => {
            const filtered = filterTeachersByStatus(
              teachers,
              'fullTime',
              maxPossiblePeriodsPerWeek
            );
            const threshold = maxPossiblePeriodsPerWeek * FULL_TIME_THRESHOLD;

            // All returned teachers must be full-time
            for (const teacher of filtered) {
              expect(teacher.maxPeriodsPerWeek).toBeGreaterThanOrEqual(threshold);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('partTime filter should only return teachers with maxPeriodsPerWeek < 80% of max', () => {
      fc.assert(
        fc.property(
          fc.array(teacherArbitrary, { minLength: 0, maxLength: 20 }),
          fc.integer({ min: 10, max: 60 }), // maxPossiblePeriodsPerWeek
          (teachers: Teacher[], maxPossiblePeriodsPerWeek: number) => {
            const filtered = filterTeachersByStatus(
              teachers,
              'partTime',
              maxPossiblePeriodsPerWeek
            );
            const threshold = maxPossiblePeriodsPerWeek * FULL_TIME_THRESHOLD;

            // All returned teachers must be part-time
            for (const teacher of filtered) {
              expect(teacher.maxPeriodsPerWeek).toBeLessThan(threshold);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('all filter should return all teachers', () => {
      fc.assert(
        fc.property(
          fc.array(teacherArbitrary, { minLength: 0, maxLength: 20 }),
          fc.integer({ min: 10, max: 60 }),
          (teachers: Teacher[], maxPossiblePeriodsPerWeek: number) => {
            const filtered = filterTeachersByStatus(teachers, 'all', maxPossiblePeriodsPerWeek);
            expect(filtered).toEqual(teachers);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('fullTime and partTime filters should partition the teacher list', () => {
      fc.assert(
        fc.property(
          uniqueTeachersArbitrary(20),
          fc.integer({ min: 10, max: 60 }),
          (teachers: Teacher[], maxPossiblePeriodsPerWeek: number) => {
            const fullTime = filterTeachersByStatus(
              teachers,
              'fullTime',
              maxPossiblePeriodsPerWeek
            );
            const partTime = filterTeachersByStatus(
              teachers,
              'partTime',
              maxPossiblePeriodsPerWeek
            );

            // The union of fullTime and partTime should equal all teachers
            expect(fullTime.length + partTime.length).toBe(teachers.length);

            // No teacher should appear in both lists
            const fullTimeIds = new Set(fullTime.map((t) => t.id));
            for (const teacher of partTime) {
              expect(fullTimeIds.has(teacher.id)).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isTeacherFullTime should be consistent with filter results', () => {
      fc.assert(
        fc.property(
          teacherArbitrary,
          fc.integer({ min: 10, max: 60 }),
          (teacher: Teacher, maxPossiblePeriodsPerWeek: number) => {
            const isFullTime = isTeacherFullTime(teacher, maxPossiblePeriodsPerWeek);
            const fullTimeFiltered = filterTeachersByStatus(
              [teacher],
              'fullTime',
              maxPossiblePeriodsPerWeek
            );
            const partTimeFiltered = filterTeachersByStatus(
              [teacher],
              'partTime',
              maxPossiblePeriodsPerWeek
            );

            if (isFullTime) {
              expect(fullTimeFiltered).toHaveLength(1);
              expect(partTimeFiltered).toHaveLength(0);
            } else {
              expect(fullTimeFiltered).toHaveLength(0);
              expect(partTimeFiltered).toHaveLength(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Combined filters (applyTeacherFilters)', () => {
    it('should apply both search and status filters correctly', () => {
      fc.assert(
        fc.property(
          fc.array(teacherArbitrary, { minLength: 0, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 10 }),
          fc.constantFrom('all', 'fullTime', 'partTime') as fc.Arbitrary<
            'all' | 'fullTime' | 'partTime'
          >,
          fc.integer({ min: 10, max: 60 }),
          (
            teachers: Teacher[],
            search: string,
            statusFilter,
            maxPossiblePeriodsPerWeek: number
          ) => {
            const filters: TeacherFiltersState = { search, statusFilter };
            const filtered = applyTeacherFilters(teachers, filters, maxPossiblePeriodsPerWeek);

            // Apply filters manually to verify
            const searchFiltered = filterTeachersBySearch(teachers, search);
            const expected = filterTeachersByStatus(
              searchFiltered,
              statusFilter,
              maxPossiblePeriodsPerWeek
            );

            expect(filtered).toEqual(expected);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filtered count should never exceed total count', () => {
      fc.assert(
        fc.property(
          fc.array(teacherArbitrary, { minLength: 0, maxLength: 20 }),
          fc.string({ minLength: 0, maxLength: 10 }),
          fc.constantFrom('all', 'fullTime', 'partTime') as fc.Arbitrary<
            'all' | 'fullTime' | 'partTime'
          >,
          fc.integer({ min: 10, max: 60 }),
          (
            teachers: Teacher[],
            search: string,
            statusFilter,
            maxPossiblePeriodsPerWeek: number
          ) => {
            const filters: TeacherFiltersState = { search, statusFilter };
            const filtered = applyTeacherFilters(teachers, filters, maxPossiblePeriodsPerWeek);

            expect(filtered.length).toBeLessThanOrEqual(teachers.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
