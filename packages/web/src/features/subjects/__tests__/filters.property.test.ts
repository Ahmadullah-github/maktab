/**
 * Property-based tests for subject filter functions
 *
 * **Feature: subjects-feature, Properties 2-5: Filter Correctness**
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 *
 * Property 2: Section Filter Correctness
 * *For any* list of subjects and any section filter value (PRIMARY, MIDDLE, HIGH),
 * all subjects in the filtered result should have a section matching the filter value.
 * When filter is 'all', all subjects should be returned.
 *
 * Property 3: Search Filter Correctness
 * *For any* list of subjects and any non-empty search term, all subjects in the
 * filtered result should contain the search term (case-insensitive) in either
 * their name or code field.
 *
 * Property 4: Combined Filter Correctness
 * *For any* list of subjects, section filter, and search term, the filtered result
 * should satisfy both filter conditions simultaneously.
 *
 * Property 5: Filter Count Invariant
 * *For any* list of subjects and any filter state, the filtered count should
 * always be less than or equal to the total count.
 */

import * as fc from 'fast-check';
import { describe, it } from 'vitest';
import {
  applySubjectFilters,
  filterSubjectsBySearch,
  filterSubjectsBySection,
} from '../hooks/useSubjectFilters';
import type { RoomType, Section, SectionFilter, Subject, SubjectFiltersState } from '../types';

/**
 * Arbitrary generator for valid section values
 */
const sectionArb: fc.Arbitrary<Section> = fc.constantFrom('PRIMARY', 'MIDDLE', 'HIGH', '' as const);

/**
 * Arbitrary generator for section filter values (includes 'all')
 */
const sectionFilterArb: fc.Arbitrary<SectionFilter> = fc.constantFrom(
  'all',
  'PRIMARY',
  'MIDDLE',
  'HIGH'
);

/**
 * Arbitrary generator for valid room type values
 */
const roomTypeArb: fc.Arbitrary<RoomType> = fc.constantFrom(
  'classroom',
  'lab',
  'gym',
  'library',
  '' as const
);

/**
 * Arbitrary generator for valid ISO date strings
 */
const isoDateStringArb: fc.Arbitrary<string> = fc.constantFrom(
  '2020-01-15T10:30:00.000Z',
  '2021-06-20T14:45:30.000Z',
  '2022-12-01T08:00:00.000Z',
  '2023-03-10T16:20:15.000Z',
  '2024-09-25T12:00:00.000Z'
);

/**
 * Arbitrary generator for Subject entity
 */
const subjectArb: fc.Arbitrary<Subject> = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  schoolId: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  code: fc.string({ minLength: 1, maxLength: 10 }),
  grade: fc.option(fc.integer({ min: 1, max: 12 }), { nil: null }),
  periodsPerWeek: fc.option(fc.integer({ min: 1, max: 10 }), { nil: null }),
  section: sectionArb,
  requiredRoomType: roomTypeArb,
  requiredFeatures: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
  desiredFeatures: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
  isDifficult: fc.boolean(),
  minRoomCapacity: fc.integer({ min: 0, max: 500 }),
  meta: fc.constant({}),
  isDeleted: fc.constant(false),
  deletedAt: fc.constant(null),
  createdAt: isoDateStringArb,
  updatedAt: isoDateStringArb,
});

/**
 * Arbitrary generator for array of subjects
 */
const subjectsArrayArb: fc.Arbitrary<Subject[]> = fc.array(subjectArb, {
  minLength: 0,
  maxLength: 50,
});

/**
 * Arbitrary generator for search terms
 */
const searchTermArb: fc.Arbitrary<string> = fc.string({ minLength: 0, maxLength: 20 });

/**
 * Arbitrary generator for non-empty search terms
 */
const nonEmptySearchTermArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => s.trim().length > 0);

/**
 * Arbitrary generator for SubjectFiltersState
 */
const filtersStateArb: fc.Arbitrary<SubjectFiltersState> = fc.record({
  search: searchTermArb,
  section: sectionFilterArb,
});

describe('Subject Filter Property Tests', () => {
  describe('filterSubjectsBySection', () => {
    /**
     * **Feature: subjects-feature, Property 2: Section Filter Correctness**
     * **Validates: Requirements 2.1**
     *
     * When filter is 'all', all subjects should be returned
     */
    it("Property 2: 'all' filter returns all subjects", () => {
      fc.assert(
        fc.property(subjectsArrayArb, (subjects) => {
          const filtered = filterSubjectsBySection(subjects, 'all');
          return filtered.length === subjects.length;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: subjects-feature, Property 2: Section Filter Correctness**
     * **Validates: Requirements 2.1**
     *
     * For any specific section filter, all results should match that section
     */
    it('Property 2: Specific section filter returns only matching subjects', () => {
      const specificSectionArb: fc.Arbitrary<'PRIMARY' | 'MIDDLE' | 'HIGH'> = fc.constantFrom(
        'PRIMARY',
        'MIDDLE',
        'HIGH'
      );

      fc.assert(
        fc.property(subjectsArrayArb, specificSectionArb, (subjects, section) => {
          const filtered = filterSubjectsBySection(subjects, section);

          // All filtered subjects should have the matching section
          return filtered.every((subject) => subject.section === section);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: subjects-feature, Property 2: Section Filter Correctness**
     * **Validates: Requirements 2.1**
     *
     * Section filter should not miss any matching subjects
     */
    it('Property 2: Section filter includes all matching subjects', () => {
      const specificSectionArb: fc.Arbitrary<'PRIMARY' | 'MIDDLE' | 'HIGH'> = fc.constantFrom(
        'PRIMARY',
        'MIDDLE',
        'HIGH'
      );

      fc.assert(
        fc.property(subjectsArrayArb, specificSectionArb, (subjects, section) => {
          const filtered = filterSubjectsBySection(subjects, section);
          const expectedCount = subjects.filter((s) => s.section === section).length;

          return filtered.length === expectedCount;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('filterSubjectsBySearch', () => {
    /**
     * **Feature: subjects-feature, Property 3: Search Filter Correctness**
     * **Validates: Requirements 2.2**
     *
     * Empty search term returns all subjects
     */
    it('Property 3: Empty search returns all subjects', () => {
      fc.assert(
        fc.property(subjectsArrayArb, (subjects) => {
          const filteredEmpty = filterSubjectsBySearch(subjects, '');
          const filteredWhitespace = filterSubjectsBySearch(subjects, '   ');

          return (
            filteredEmpty.length === subjects.length &&
            filteredWhitespace.length === subjects.length
          );
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: subjects-feature, Property 3: Search Filter Correctness**
     * **Validates: Requirements 2.2**
     *
     * All filtered results should contain the search term in name or code
     */
    it('Property 3: All results contain search term in name or code', () => {
      fc.assert(
        fc.property(subjectsArrayArb, nonEmptySearchTermArb, (subjects, searchTerm) => {
          const filtered = filterSubjectsBySearch(subjects, searchTerm);
          const normalizedSearch = searchTerm.toLowerCase().trim();

          return filtered.every((subject) => {
            const name = subject.name?.toLowerCase() || '';
            const code = subject.code?.toLowerCase() || '';
            return name.includes(normalizedSearch) || code.includes(normalizedSearch);
          });
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: subjects-feature, Property 3: Search Filter Correctness**
     * **Validates: Requirements 2.2**
     *
     * Search should be case-insensitive
     */
    it('Property 3: Search is case-insensitive', () => {
      fc.assert(
        fc.property(subjectsArrayArb, nonEmptySearchTermArb, (subjects, searchTerm) => {
          const lowerResult = filterSubjectsBySearch(subjects, searchTerm.toLowerCase());
          const upperResult = filterSubjectsBySearch(subjects, searchTerm.toUpperCase());
          const mixedResult = filterSubjectsBySearch(subjects, searchTerm);

          // All variations should return the same number of results
          return (
            lowerResult.length === upperResult.length && upperResult.length === mixedResult.length
          );
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: subjects-feature, Property 3: Search Filter Correctness**
     * **Validates: Requirements 2.2**
     *
     * Search should not miss any matching subjects
     */
    it('Property 3: Search includes all matching subjects', () => {
      fc.assert(
        fc.property(subjectsArrayArb, nonEmptySearchTermArb, (subjects, searchTerm) => {
          const filtered = filterSubjectsBySearch(subjects, searchTerm);
          const normalizedSearch = searchTerm.toLowerCase().trim();

          const expectedCount = subjects.filter((subject) => {
            const name = subject.name?.toLowerCase() || '';
            const code = subject.code?.toLowerCase() || '';
            return name.includes(normalizedSearch) || code.includes(normalizedSearch);
          }).length;

          return filtered.length === expectedCount;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('applySubjectFilters (Combined Filters)', () => {
    /**
     * **Feature: subjects-feature, Property 4: Combined Filter Correctness**
     * **Validates: Requirements 2.3**
     *
     * Combined filters should satisfy both conditions
     */
    it('Property 4: Combined filters satisfy both section and search conditions', () => {
      fc.assert(
        fc.property(subjectsArrayArb, filtersStateArb, (subjects, filters) => {
          const filtered = applySubjectFilters(subjects, filters);
          const normalizedSearch = filters.search.toLowerCase().trim();

          return filtered.every((subject) => {
            // Check section condition
            const sectionMatch = filters.section === 'all' || subject.section === filters.section;

            // Check search condition
            const searchMatch =
              normalizedSearch === '' ||
              (subject.name?.toLowerCase() || '').includes(normalizedSearch) ||
              (subject.code?.toLowerCase() || '').includes(normalizedSearch);

            return sectionMatch && searchMatch;
          });
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: subjects-feature, Property 4: Combined Filter Correctness**
     * **Validates: Requirements 2.3**
     *
     * Combined filter result should be intersection of individual filters
     */
    it('Property 4: Combined filter is intersection of individual filters', () => {
      fc.assert(
        fc.property(subjectsArrayArb, filtersStateArb, (subjects, filters) => {
          const combined = applySubjectFilters(subjects, filters);
          const sectionFiltered = filterSubjectsBySection(subjects, filters.section);
          const searchFiltered = filterSubjectsBySearch(subjects, filters.search);

          // Combined should be subset of both individual filters
          const sectionIds = new Set(sectionFiltered.map((s) => s.id));
          const searchIds = new Set(searchFiltered.map((s) => s.id));

          // Every combined result should be in both individual results
          return combined.every(
            (subject) => sectionIds.has(subject.id) && searchIds.has(subject.id)
          );
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Filter Count Invariant', () => {
    /**
     * **Feature: subjects-feature, Property 5: Filter Count Invariant**
     * **Validates: Requirements 2.4**
     *
     * Filtered count should always be <= total count
     */
    it('Property 5: Filtered count is always <= total count', () => {
      fc.assert(
        fc.property(subjectsArrayArb, filtersStateArb, (subjects, filters) => {
          const filtered = applySubjectFilters(subjects, filters);
          return filtered.length <= subjects.length;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: subjects-feature, Property 5: Filter Count Invariant**
     * **Validates: Requirements 2.4**
     *
     * Section filter count should be <= total count
     */
    it('Property 5: Section filter count is always <= total count', () => {
      fc.assert(
        fc.property(subjectsArrayArb, sectionFilterArb, (subjects, section) => {
          const filtered = filterSubjectsBySection(subjects, section);
          return filtered.length <= subjects.length;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: subjects-feature, Property 5: Filter Count Invariant**
     * **Validates: Requirements 2.4**
     *
     * Search filter count should be <= total count
     */
    it('Property 5: Search filter count is always <= total count', () => {
      fc.assert(
        fc.property(subjectsArrayArb, searchTermArb, (subjects, searchTerm) => {
          const filtered = filterSubjectsBySearch(subjects, searchTerm);
          return filtered.length <= subjects.length;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: subjects-feature, Property 5: Filter Count Invariant**
     * **Validates: Requirements 2.4**
     *
     * Combined filter count should be <= individual filter counts
     */
    it('Property 5: Combined filter count is <= individual filter counts', () => {
      fc.assert(
        fc.property(subjectsArrayArb, filtersStateArb, (subjects, filters) => {
          const combined = applySubjectFilters(subjects, filters);
          const sectionFiltered = filterSubjectsBySection(subjects, filters.section);
          const searchFiltered = filterSubjectsBySearch(subjects, filters.search);

          return (
            combined.length <= sectionFiltered.length && combined.length <= searchFiltered.length
          );
        }),
        { numRuns: 100 }
      );
    });
  });
});
