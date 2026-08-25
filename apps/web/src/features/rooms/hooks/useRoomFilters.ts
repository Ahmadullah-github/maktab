/**
 * Filter state hook for Rooms list
 *
 * Manages search and type filter state,
 * and provides filtering logic for the rooms list
 *
 * Requirements: 2.1, 2.2, 2.3
 */

import { useCallback, useMemo, useState } from 'react';
import type { Room, RoomFiltersState, RoomTypeFilter } from '../types';

/**
 * Default filter state
 */
const DEFAULT_FILTERS: RoomFiltersState = {
  search: '',
  typeFilter: 'all',
};

/**
 * Filters rooms by search term
 * Matches against name (case-insensitive partial match)
 *
 * @param rooms - Array of rooms to filter
 * @param searchTerm - Search term to match
 * @returns Filtered array of rooms
 *
 * Requirements: 2.1
 */
export function filterRoomsBySearch(rooms: Room[], searchTerm: string): Room[] {
  if (!searchTerm || searchTerm.trim() === '') {
    return rooms;
  }

  const normalizedSearch = searchTerm.toLowerCase().trim();

  return rooms.filter((room) => {
    const name = room.name?.toLowerCase() || '';
    return name.includes(normalizedSearch);
  });
}

/**
 * Filters rooms by type
 *
 * @param rooms - Array of rooms to filter
 * @param typeFilter - Type filter value ('all', 'normal', 'computer_lab', 'biology_lab', 'chemistry_lab', 'math_lab', 'physics_lab', 'lab', 'library', 'salon', 'gym', 'sport_camp', 'other', '')
 * @returns Filtered array of rooms
 *
 * Requirements: 2.2
 */
export function filterRoomsByType(rooms: Room[], typeFilter: RoomTypeFilter): Room[] {
  if (typeFilter === 'all') {
    return rooms;
  }

  return rooms.filter((room) => room.type === typeFilter);
}

/**
 * Applies all filters to a rooms array
 * Combines search and type filters
 *
 * @param rooms - Array of rooms to filter
 * @param filters - Filter state to apply
 * @returns Filtered array of rooms
 *
 * Requirements: 2.3
 */
export function applyRoomFilters(rooms: Room[], filters: RoomFiltersState): Room[] {
  let result = rooms;

  // Apply search filter
  result = filterRoomsBySearch(result, filters.search);

  // Apply type filter
  result = filterRoomsByType(result, filters.typeFilter);

  return result;
}

/**
 * Hook for managing room filter state and applying filters
 *
 * @param rooms - Array of rooms to filter (optional)
 * @returns Filter state, setters, and filtered rooms
 *
 * Requirements: 2.1, 2.2, 2.3
 */
export function useRoomFilters(rooms: Room[] = []) {
  const [filters, setFilters] = useState<RoomFiltersState>(DEFAULT_FILTERS);

  /**
   * Updates the search filter
   */
  const setSearch = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search }));
  }, []);

  /**
   * Updates the type filter
   */
  const setTypeFilter = useCallback((typeFilter: RoomTypeFilter) => {
    setFilters((prev) => ({ ...prev, typeFilter }));
  }, []);

  /**
   * Resets all filters to default values
   */
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  /**
   * Memoized filtered rooms
   */
  const filteredRooms = useMemo(() => {
    return applyRoomFilters(rooms, filters);
  }, [rooms, filters]);

  return {
    // Current filter state
    filters,
    search: filters.search,
    typeFilter: filters.typeFilter,

    // Setters
    setSearch,
    setTypeFilter,
    setFilters,
    resetFilters,

    // Filtered result
    filteredRooms,

    // Computed values (Requirements: 2.3)
    hasActiveFilters: filters.search !== '' || filters.typeFilter !== 'all',
    totalCount: rooms.length,
    filteredCount: filteredRooms.length,
  };
}
