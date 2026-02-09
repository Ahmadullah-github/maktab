/**
 * Property-based tests for room filter functions
 *
 * **Feature: rooms-feature, Properties 1-3: Filter Correctness**
 * **Validates: Requirements 2.1, 2.2, 2.3**
 *
 * Property 1: Search filter returns matching rooms
 * *For any* list of rooms and any search string, all rooms in the filtered result
 * should have names that contain the search string (case-insensitive partial match).
 *
 * Property 2: Type filter returns matching rooms
 * *For any* list of rooms and any type filter value (other than 'all'), all rooms
 * in the filtered result should have a type matching the filter value.
 *
 * Property 3: Filter count accuracy
 * *For any* list of rooms and any combination of filters, the displayed filtered
 * count should equal the actual length of the filtered rooms array.
 */

import * as fc from 'fast-check';
import { describe, it } from 'vitest';
import { applyRoomFilters, filterRoomsBySearch, filterRoomsByType } from '../hooks/useRoomFilters';
import type { Room, RoomFiltersState, RoomType, RoomTypeFilter, UnavailableSlot } from '../types';

/**
 * Arbitrary generator for valid room type values
 */
const roomTypeArb: fc.Arbitrary<RoomType> = fc.constantFrom(
  'normal',
  'computer_lab',
  'biology_lab',
  'chemistry_lab',
  'math_lab',
  'physics_lab',
  'lab',
  'library',
  'salon',
  'gym',
  'sport_camp',
  'other',
  '' as const
);

/**
 * Arbitrary generator for room type filter values (includes 'all')
 */
const roomTypeFilterArb: fc.Arbitrary<RoomTypeFilter> = fc.constantFrom(
  'all',
  'normal',
  'computer_lab',
  'biology_lab',
  'chemistry_lab',
  'math_lab',
  'physics_lab',
  'lab',
  'library',
  'salon',
  'gym',
  'sport_camp',
  'other',
  '' as const
);

/**
 * Arbitrary generator for UnavailableSlot
 */
const unavailableSlotArb: fc.Arbitrary<UnavailableSlot> = fc.record({
  day: fc.integer({ min: 0, max: 6 }),
  period: fc.integer({ min: 0, max: 10 }),
});

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
 * Arbitrary generator for Room entity
 */
const roomArb: fc.Arbitrary<Room> = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  schoolId: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  capacity: fc.integer({ min: 1, max: 500 }),
  type: roomTypeArb,
  features: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
  unavailable: fc.array(unavailableSlotArb, { maxLength: 10 }),
  meta: fc.constant({}),
  isDeleted: fc.constant(false),
  deletedAt: fc.constant(null),
  createdAt: isoDateStringArb,
  updatedAt: isoDateStringArb,
});

/**
 * Arbitrary generator for array of rooms
 */
const roomsArrayArb: fc.Arbitrary<Room[]> = fc.array(roomArb, {
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
 * Arbitrary generator for RoomFiltersState
 */
const filtersStateArb: fc.Arbitrary<RoomFiltersState> = fc.record({
  search: searchTermArb,
  typeFilter: roomTypeFilterArb,
});

describe('Room Filter Property Tests', () => {
  describe('filterRoomsBySearch', () => {
    /**
     * **Feature: rooms-feature, Property 1: Search filter returns matching rooms**
     * **Validates: Requirements 2.1**
     *
     * Empty search term returns all rooms
     */
    it('Property 1: Empty search returns all rooms', () => {
      fc.assert(
        fc.property(roomsArrayArb, (rooms) => {
          const filteredEmpty = filterRoomsBySearch(rooms, '');
          const filteredWhitespace = filterRoomsBySearch(rooms, '   ');

          return (
            filteredEmpty.length === rooms.length && filteredWhitespace.length === rooms.length
          );
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: rooms-feature, Property 1: Search filter returns matching rooms**
     * **Validates: Requirements 2.1**
     *
     * All filtered results should contain the search term in name
     */
    it('Property 1: All results contain search term in name', () => {
      fc.assert(
        fc.property(roomsArrayArb, nonEmptySearchTermArb, (rooms, searchTerm) => {
          const filtered = filterRoomsBySearch(rooms, searchTerm);
          const normalizedSearch = searchTerm.toLowerCase().trim();

          return filtered.every((room) => {
            const name = room.name?.toLowerCase() || '';
            return name.includes(normalizedSearch);
          });
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: rooms-feature, Property 1: Search filter returns matching rooms**
     * **Validates: Requirements 2.1**
     *
     * Search should be case-insensitive
     */
    it('Property 1: Search is case-insensitive', () => {
      fc.assert(
        fc.property(roomsArrayArb, nonEmptySearchTermArb, (rooms, searchTerm) => {
          const lowerResult = filterRoomsBySearch(rooms, searchTerm.toLowerCase());
          const upperResult = filterRoomsBySearch(rooms, searchTerm.toUpperCase());
          const mixedResult = filterRoomsBySearch(rooms, searchTerm);

          // All variations should return the same number of results
          return (
            lowerResult.length === upperResult.length && upperResult.length === mixedResult.length
          );
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: rooms-feature, Property 1: Search filter returns matching rooms**
     * **Validates: Requirements 2.1**
     *
     * Search should not miss any matching rooms
     */
    it('Property 1: Search includes all matching rooms', () => {
      fc.assert(
        fc.property(roomsArrayArb, nonEmptySearchTermArb, (rooms, searchTerm) => {
          const filtered = filterRoomsBySearch(rooms, searchTerm);
          const normalizedSearch = searchTerm.toLowerCase().trim();

          const expectedCount = rooms.filter((room) => {
            const name = room.name?.toLowerCase() || '';
            return name.includes(normalizedSearch);
          }).length;

          return filtered.length === expectedCount;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('filterRoomsByType', () => {
    /**
     * **Feature: rooms-feature, Property 2: Type filter returns matching rooms**
     * **Validates: Requirements 2.2**
     *
     * When filter is 'all', all rooms should be returned
     */
    it("Property 2: 'all' filter returns all rooms", () => {
      fc.assert(
        fc.property(roomsArrayArb, (rooms) => {
          const filtered = filterRoomsByType(rooms, 'all');
          return filtered.length === rooms.length;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: rooms-feature, Property 2: Type filter returns matching rooms**
     * **Validates: Requirements 2.2**
     *
     * For any specific type filter, all results should match that type
     */
    it('Property 2: Specific type filter returns only matching rooms', () => {
      const specificTypeArb: fc.Arbitrary<RoomType> = fc.constantFrom(
        'normal',
        'computer_lab',
        'biology_lab',
        'chemistry_lab',
        'math_lab',
        'physics_lab',
        'lab',
        'library',
        'salon',
        'gym',
        'sport_camp',
        'other',
        '' as const
      );

      fc.assert(
        fc.property(roomsArrayArb, specificTypeArb, (rooms, type) => {
          const filtered = filterRoomsByType(rooms, type);

          // All filtered rooms should have the matching type
          return filtered.every((room) => room.type === type);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: rooms-feature, Property 2: Type filter returns matching rooms**
     * **Validates: Requirements 2.2**
     *
     * Type filter should not miss any matching rooms
     */
    it('Property 2: Type filter includes all matching rooms', () => {
      const specificTypeArb: fc.Arbitrary<RoomType> = fc.constantFrom(
        'normal',
        'computer_lab',
        'biology_lab',
        'chemistry_lab',
        'math_lab',
        'physics_lab',
        'lab',
        'library',
        'salon',
        'gym',
        'sport_camp',
        'other',
        '' as const
      );

      fc.assert(
        fc.property(roomsArrayArb, specificTypeArb, (rooms, type) => {
          const filtered = filterRoomsByType(rooms, type);
          const expectedCount = rooms.filter((r) => r.type === type).length;

          return filtered.length === expectedCount;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('applyRoomFilters (Combined Filters)', () => {
    /**
     * **Feature: rooms-feature, Property 3: Filter count accuracy**
     * **Validates: Requirements 2.3**
     *
     * Combined filters should satisfy both conditions
     */
    it('Property 3: Combined filters satisfy both search and type conditions', () => {
      fc.assert(
        fc.property(roomsArrayArb, filtersStateArb, (rooms, filters) => {
          const filtered = applyRoomFilters(rooms, filters);
          const normalizedSearch = filters.search.toLowerCase().trim();

          return filtered.every((room) => {
            // Check search condition
            const searchMatch =
              normalizedSearch === '' ||
              (room.name?.toLowerCase() || '').includes(normalizedSearch);

            // Check type condition
            const typeMatch = filters.typeFilter === 'all' || room.type === filters.typeFilter;

            return searchMatch && typeMatch;
          });
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: rooms-feature, Property 3: Filter count accuracy**
     * **Validates: Requirements 2.3**
     *
     * Combined filter result should be intersection of individual filters
     */
    it('Property 3: Combined filter is intersection of individual filters', () => {
      fc.assert(
        fc.property(roomsArrayArb, filtersStateArb, (rooms, filters) => {
          const combined = applyRoomFilters(rooms, filters);
          const searchFiltered = filterRoomsBySearch(rooms, filters.search);
          const typeFiltered = filterRoomsByType(rooms, filters.typeFilter);

          // Combined should be subset of both individual filters
          const searchIds = new Set(searchFiltered.map((r) => r.id));
          const typeIds = new Set(typeFiltered.map((r) => r.id));

          // Every combined result should be in both individual results
          return combined.every((room) => searchIds.has(room.id) && typeIds.has(room.id));
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Filter Count Invariant', () => {
    /**
     * **Feature: rooms-feature, Property 3: Filter count accuracy**
     * **Validates: Requirements 2.3**
     *
     * Filtered count should always be <= total count
     */
    it('Property 3: Filtered count is always <= total count', () => {
      fc.assert(
        fc.property(roomsArrayArb, filtersStateArb, (rooms, filters) => {
          const filtered = applyRoomFilters(rooms, filters);
          return filtered.length <= rooms.length;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: rooms-feature, Property 3: Filter count accuracy**
     * **Validates: Requirements 2.3**
     *
     * Search filter count should be <= total count
     */
    it('Property 3: Search filter count is always <= total count', () => {
      fc.assert(
        fc.property(roomsArrayArb, searchTermArb, (rooms, searchTerm) => {
          const filtered = filterRoomsBySearch(rooms, searchTerm);
          return filtered.length <= rooms.length;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: rooms-feature, Property 3: Filter count accuracy**
     * **Validates: Requirements 2.3**
     *
     * Type filter count should be <= total count
     */
    it('Property 3: Type filter count is always <= total count', () => {
      fc.assert(
        fc.property(roomsArrayArb, roomTypeFilterArb, (rooms, typeFilter) => {
          const filtered = filterRoomsByType(rooms, typeFilter);
          return filtered.length <= rooms.length;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: rooms-feature, Property 3: Filter count accuracy**
     * **Validates: Requirements 2.3**
     *
     * Combined filter count should be <= individual filter counts
     */
    it('Property 3: Combined filter count is <= individual filter counts', () => {
      fc.assert(
        fc.property(roomsArrayArb, filtersStateArb, (rooms, filters) => {
          const combined = applyRoomFilters(rooms, filters);
          const searchFiltered = filterRoomsBySearch(rooms, filters.search);
          const typeFiltered = filterRoomsByType(rooms, filters.typeFilter);

          return combined.length <= searchFiltered.length && combined.length <= typeFiltered.length;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: rooms-feature, Property 3: Filter count accuracy**
     * **Validates: Requirements 2.3**
     *
     * The filtered count should equal the actual length of the filtered array
     */
    it('Property 3: Filtered count equals actual filtered array length', () => {
      fc.assert(
        fc.property(roomsArrayArb, filtersStateArb, (rooms, filters) => {
          const filtered = applyRoomFilters(rooms, filters);

          // Manually count rooms that match both filters
          const normalizedSearch = filters.search.toLowerCase().trim();
          const manualCount = rooms.filter((room) => {
            const searchMatch =
              normalizedSearch === '' ||
              (room.name?.toLowerCase() || '').includes(normalizedSearch);
            const typeMatch = filters.typeFilter === 'all' || room.type === filters.typeFilter;
            return searchMatch && typeMatch;
          }).length;

          return filtered.length === manualCount;
        }),
        { numRuns: 100 }
      );
    });
  });
});
