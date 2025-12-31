/**
 * Filter state hook for Teachers list
 *
 * Manages search and status filter state,
 * and provides filtering logic for the teachers list
 *
 * Requirements: 1.2, 1.3
 */

import { useCallback, useMemo, useState } from 'react';
import type { Teacher, TeacherFiltersState, TeacherStatusFilter } from '../types';
import type { SchoolConfig } from './useSchoolConfig';

/**
 * Default filter state
 */
const DEFAULT_FILTERS: TeacherFiltersState = {
  search: '',
  statusFilter: 'all',
};

/**
 * Threshold percentage for determining full-time vs part-time status
 * Teachers with maxPeriodsPerWeek >= 80% of max are considered full-time
 */
const FULL_TIME_THRESHOLD = 0.8;

/**
 * Filters teachers by search term
 * Matches against fullName (case-insensitive)
 *
 * @param teachers - Array of teachers to filter
 * @param searchTerm - Search term to match
 * @returns Filtered array of teachers
 *
 * Requirements: 1.2
 */
export function filterTeachersBySearch(teachers: Teacher[], searchTerm: string): Teacher[] {
  if (!searchTerm || searchTerm.trim() === '') {
    return teachers;
  }

  const normalizedSearch = searchTerm.toLowerCase().trim();

  return teachers.filter((teacher) => {
    const fullName = teacher.fullName?.toLowerCase() || '';
    return fullName.includes(normalizedSearch);
  });
}

/**
 * Determines if a teacher is full-time based on their maxPeriodsPerWeek
 * relative to the maximum possible periods from SchoolConfig
 *
 * @param teacher - Teacher to check
 * @param maxPossiblePeriodsPerWeek - Maximum periods per week from SchoolConfig
 * @returns true if teacher is full-time, false otherwise
 */
export function isTeacherFullTime(teacher: Teacher, maxPossiblePeriodsPerWeek: number): boolean {
  if (maxPossiblePeriodsPerWeek <= 0) {
    return true; // Default to full-time if config is invalid
  }
  return teacher.maxPeriodsPerWeek >= maxPossiblePeriodsPerWeek * FULL_TIME_THRESHOLD;
}

/**
 * Filters teachers by employment status (full-time or part-time)
 *
 * @param teachers - Array of teachers to filter
 * @param statusFilter - Status filter to apply
 * @param maxPossiblePeriodsPerWeek - Maximum periods per week from SchoolConfig
 * @returns Filtered array of teachers
 *
 * Requirements: 1.3
 */
export function filterTeachersByStatus(
  teachers: Teacher[],
  statusFilter: TeacherStatusFilter,
  maxPossiblePeriodsPerWeek: number
): Teacher[] {
  if (statusFilter === 'all') {
    return teachers;
  }

  return teachers.filter((teacher) => {
    const isFullTime = isTeacherFullTime(teacher, maxPossiblePeriodsPerWeek);
    return statusFilter === 'fullTime' ? isFullTime : !isFullTime;
  });
}

/**
 * Applies all filters to a teachers array
 *
 * @param teachers - Array of teachers to filter
 * @param filters - Filter state to apply
 * @param maxPossiblePeriodsPerWeek - Maximum periods per week from SchoolConfig
 * @returns Filtered array of teachers
 */
export function applyTeacherFilters(
  teachers: Teacher[],
  filters: TeacherFiltersState,
  maxPossiblePeriodsPerWeek: number
): Teacher[] {
  let result = teachers;

  // Apply search filter
  result = filterTeachersBySearch(result, filters.search);

  // Apply status filter
  result = filterTeachersByStatus(result, filters.statusFilter, maxPossiblePeriodsPerWeek);

  return result;
}

/**
 * Hook for managing teacher filter state and applying filters
 *
 * @param teachers - Array of teachers to filter (optional)
 * @param schoolConfig - SchoolConfig for calculating max periods (optional)
 * @returns Filter state, setters, and filtered teachers
 *
 * Requirements: 1.2, 1.3
 */
export function useTeacherFilters(teachers: Teacher[] = [], schoolConfig?: SchoolConfig) {
  const [filters, setFilters] = useState<TeacherFiltersState>(DEFAULT_FILTERS);

  /**
   * Calculate max possible periods per week from SchoolConfig
   */
  const maxPossiblePeriodsPerWeek = useMemo(() => {
    if (!schoolConfig) {
      return 42; // Default fallback (6 days × 7 periods)
    }
    return schoolConfig.daysPerWeek * schoolConfig.defaultPeriodsPerDay;
  }, [schoolConfig]);

  /**
   * Updates the search filter
   */
  const setSearch = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search }));
  }, []);

  /**
   * Updates the status filter
   */
  const setStatusFilter = useCallback((statusFilter: TeacherStatusFilter) => {
    setFilters((prev) => ({ ...prev, statusFilter }));
  }, []);

  /**
   * Resets all filters to default values
   */
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  /**
   * Memoized filtered teachers
   */
  const filteredTeachers = useMemo(() => {
    return applyTeacherFilters(teachers, filters, maxPossiblePeriodsPerWeek);
  }, [teachers, filters, maxPossiblePeriodsPerWeek]);

  return {
    // Current filter state
    filters,
    search: filters.search,
    statusFilter: filters.statusFilter,

    // Setters
    setSearch,
    setStatusFilter,
    setFilters,
    resetFilters,

    // Filtered result
    filteredTeachers,

    // Computed values
    hasActiveFilters: filters.search !== '' || filters.statusFilter !== 'all',
    totalCount: teachers.length,
    filteredCount: filteredTeachers.length,
    maxPossiblePeriodsPerWeek,
  };
}
