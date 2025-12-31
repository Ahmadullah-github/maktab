/**
 * Filter state hook for Classes list
 *
 * Manages search and grade category filter state,
 * and provides filtering logic for the classes list
 *
 * Requirements: 1.2, 1.3
 */

import { useCallback, useMemo, useState } from 'react';
import type { ClassFiltersState, ClassGroup, GradeCategory } from '../types';
import { isGradeInCategory } from '../utils/gradeCategory';

/**
 * Default filter state
 */
const DEFAULT_FILTERS: ClassFiltersState = {
  search: '',
  gradeCategory: 'all',
};

/**
 * Filters classes by search term
 * Matches against name, displayName, and sectionIndex (case-insensitive)
 *
 * @param classes - Array of classes to filter
 * @param searchTerm - Search term to match
 * @returns Filtered array of classes
 *
 * Requirements: 1.2
 */
export function filterClassesBySearch(classes: ClassGroup[], searchTerm: string): ClassGroup[] {
  if (!searchTerm || searchTerm.trim() === '') {
    return classes;
  }

  const normalizedSearch = searchTerm.toLowerCase().trim();

  return classes.filter((classGroup) => {
    const name = classGroup.name?.toLowerCase() || '';
    const displayName = classGroup.displayName?.toLowerCase() || '';
    const sectionIndex = classGroup.sectionIndex?.toLowerCase() || '';

    return (
      name.includes(normalizedSearch) ||
      displayName.includes(normalizedSearch) ||
      sectionIndex.includes(normalizedSearch)
    );
  });
}

/**
 * Filters classes by grade category
 *
 * @param classes - Array of classes to filter
 * @param category - Grade category to filter by
 * @returns Filtered array of classes
 *
 * Requirements: 1.3
 */
export function filterClassesByGradeCategory(
  classes: ClassGroup[],
  category: GradeCategory
): ClassGroup[] {
  if (category === 'all') {
    return classes;
  }

  return classes.filter((classGroup) => isGradeInCategory(classGroup.grade, category));
}

/**
 * Applies all filters to a classes array
 *
 * @param classes - Array of classes to filter
 * @param filters - Filter state to apply
 * @returns Filtered array of classes
 */
export function applyClassFilters(classes: ClassGroup[], filters: ClassFiltersState): ClassGroup[] {
  let result = classes;

  // Apply search filter
  result = filterClassesBySearch(result, filters.search);

  // Apply grade category filter
  result = filterClassesByGradeCategory(result, filters.gradeCategory);

  return result;
}

/**
 * Hook for managing class filter state and applying filters
 *
 * @param classes - Array of classes to filter (optional)
 * @returns Filter state, setters, and filtered classes
 *
 * Requirements: 1.2, 1.3
 */
export function useClassFilters(classes: ClassGroup[] = []) {
  const [filters, setFilters] = useState<ClassFiltersState>(DEFAULT_FILTERS);

  /**
   * Updates the search filter
   */
  const setSearch = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search }));
  }, []);

  /**
   * Updates the grade category filter
   */
  const setGradeCategory = useCallback((gradeCategory: GradeCategory) => {
    setFilters((prev) => ({ ...prev, gradeCategory }));
  }, []);

  /**
   * Resets all filters to default values
   */
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  /**
   * Memoized filtered classes
   */
  const filteredClasses = useMemo(() => {
    return applyClassFilters(classes, filters);
  }, [classes, filters]);

  return {
    // Current filter state
    filters,
    search: filters.search,
    gradeCategory: filters.gradeCategory,

    // Setters
    setSearch,
    setGradeCategory,
    setFilters,
    resetFilters,

    // Filtered result
    filteredClasses,

    // Computed values
    hasActiveFilters: filters.search !== '' || filters.gradeCategory !== 'all',
    totalCount: classes.length,
    filteredCount: filteredClasses.length,
  };
}
