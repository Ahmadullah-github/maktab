/**
 * Grade category utility functions for Afghan education system
 *
 * Afghan grade classification:
 * - alphaPrimary: Grades 1-3 (single-teacher mode)
 * - betaPrimary: Grades 4-6
 * - middle: Grades 7-9
 * - high: Grades 10-12
 *
 * Requirements: 5.3, 5.4, 2.5
 */

import type { GradeCategory } from '../types';

/**
 * Color classes for grade category badges
 * Used for visual distinction in the UI
 */
export const GRADE_CATEGORY_COLORS: Record<GradeCategory, string> = {
  all: 'bg-gray-100 text-gray-800',
  alphaPrimary: 'bg-green-100 text-green-800',
  betaPrimary: 'bg-blue-100 text-blue-800',
  middle: 'bg-purple-100 text-purple-800',
  high: 'bg-orange-100 text-orange-800',
};

/**
 * Determines the grade category for a given grade number
 *
 * @param grade - The grade number (1-12) or null
 * @returns The corresponding grade category
 *
 * Requirements: 5.3, 5.4
 */
export function getGradeCategory(grade: number | null): GradeCategory {
  if (grade === null) return 'all';
  if (grade >= 1 && grade <= 3) return 'alphaPrimary';
  if (grade >= 4 && grade <= 6) return 'betaPrimary';
  if (grade >= 7 && grade <= 9) return 'middle';
  if (grade >= 10 && grade <= 12) return 'high';
  return 'all';
}

/**
 * Checks if a grade belongs to a specific category
 *
 * @param grade - The grade number (1-12) or null
 * @param category - The category to check against
 * @returns True if the grade belongs to the category
 *
 * Requirements: 5.2
 */
export function isGradeInCategory(grade: number | null, category: GradeCategory): boolean {
  if (category === 'all') return true;
  return getGradeCategory(grade) === category;
}

/**
 * Determines if single-teacher mode should be auto-enabled for a grade
 * Single-teacher mode is for Alpha-Primary grades (1-3) where one teacher
 * teaches all subjects
 *
 * @param grade - The grade number (1-12) or null
 * @returns True if single-teacher mode should be enabled
 *
 * Requirements: 2.5, 5.4
 */
export function shouldEnableSingleTeacherMode(grade: number | null): boolean {
  return grade !== null && grade >= 1 && grade <= 3;
}
