/**
 * Filter state hook for Subjects list
 *
 * Manages search and section filter state,
 * and provides filtering logic for the subjects list
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import { useCallback, useMemo, useState } from 'react';
import type { GradeFilter, SectionFilter, Subject, SubjectFiltersState } from '../types';

/**
 * Default filter state
 */
const DEFAULT_FILTERS: SubjectFiltersState = {
  search: '',
  section: 'all',
  grade: 'all',
};

/**
 * Filters subjects by section
 *
 * @param subjects - Array of subjects to filter
 * @param section - Section filter value ('all', 'PRIMARY', 'MIDDLE', 'HIGH')
 * @returns Filtered array of subjects
 *
 * Requirements: 2.1
 */
export function filterSubjectsBySection(subjects: Subject[], section: SectionFilter): Subject[] {
  if (section === 'all') {
    return subjects;
  }

  // Case-insensitive comparison for section filter
  return subjects.filter((subject) => subject.section?.toUpperCase() === section.toUpperCase());
}

/**
 * Filters subjects by search term
 * Matches against name or code (case-insensitive)
 *
 * @param subjects - Array of subjects to filter
 * @param searchTerm - Search term to match
 * @returns Filtered array of subjects
 *
 * Requirements: 2.2
 */
export function filterSubjectsBySearch(subjects: Subject[], searchTerm: string): Subject[] {
  if (!searchTerm || searchTerm.trim() === '') {
    return subjects;
  }

  const normalizedSearch = searchTerm.toLowerCase().trim();

  return subjects.filter((subject) => {
    const name = subject.name?.toLowerCase() || '';
    const code = subject.code?.toLowerCase() || '';

    return name.includes(normalizedSearch) || code.includes(normalizedSearch);
  });
}

/**
 * Filters subjects by grade
 *
 * @param subjects - Array of subjects to filter
 * @param grade - Grade filter value ('all' or specific grade number)
 * @returns Filtered array of subjects
 */
export function filterSubjectsByGrade(subjects: Subject[], grade: GradeFilter): Subject[] {
  if (grade === 'all') {
    return subjects;
  }

  return subjects.filter((subject) => subject.grade === grade);
}

/**
 * Applies all filters to a subjects array
 * Combines section, grade, and search filters
 *
 * @param subjects - Array of subjects to filter
 * @param filters - Filter state to apply
 * @returns Filtered array of subjects
 *
 * Requirements: 2.3
 */
export function applySubjectFilters(subjects: Subject[], filters: SubjectFiltersState): Subject[] {
  let result = subjects;

  // Apply section filter
  result = filterSubjectsBySection(result, filters.section);

  // Apply grade filter
  result = filterSubjectsByGrade(result, filters.grade);

  // Apply search filter
  result = filterSubjectsBySearch(result, filters.search);

  return result;
}

/**
 * Hook for managing subject filter state and applying filters
 *
 * @param subjects - Array of subjects to filter (optional)
 * @returns Filter state, setters, and filtered subjects
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */
export function useSubjectFilters(subjects: Subject[] = []) {
  const [filters, setFilters] = useState<SubjectFiltersState>(DEFAULT_FILTERS);

  /**
   * Updates the search filter
   */
  const setSearch = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search }));
  }, []);

  /**
   * Updates the section filter
   */
  const setSection = useCallback((section: SectionFilter) => {
    setFilters((prev) => ({ ...prev, section }));
  }, []);

  /**
   * Updates the grade filter
   */
  const setGrade = useCallback((grade: GradeFilter) => {
    setFilters((prev) => ({ ...prev, grade }));
  }, []);

  /**
   * Resets all filters to default values
   */
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  /**
   * Memoized filtered subjects
   */
  const filteredSubjects = useMemo(() => {
    return applySubjectFilters(subjects, filters);
  }, [subjects, filters]);

  return {
    // Current filter state
    filters,
    search: filters.search,
    section: filters.section,
    grade: filters.grade,

    // Setters
    setSearch,
    setSection,
    setGrade,
    setFilters,
    resetFilters,

    // Filtered result
    filteredSubjects,

    // Computed values (Requirements: 2.4)
    hasActiveFilters: filters.search !== '' || filters.section !== 'all' || filters.grade !== 'all',
    totalCount: subjects.length,
    filteredCount: filteredSubjects.length,
  };
}
