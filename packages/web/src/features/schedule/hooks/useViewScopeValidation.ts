/**
 * useViewScopeValidation Hook
 *
 * Validates and filters lessons for the current view scope
 * Ensures viewId matches lesson data
 *
 * Phase 2 Enhancement: Addresses Issue #3
 * - Validates view scope against lesson data
 * - Filters lessons for current view
 * - Returns warnings for mismatches
 * - Prevents silent data corruption
 */

import { useMemo } from 'react';
import type { EnrichedLesson } from '../types';
import { logger } from '../utils/logger';

export interface ViewScopeValidationResult {
  /** True if validation passed */
  isValid: boolean;
  /** Filtered lessons for current view */
  filteredLessons: EnrichedLesson[];
  /** Warning messages (Farsi) */
  warnings: string[];
}

/**
 * Validates and filters lessons for the current view scope
 *
 * @param lessons - All enriched lessons
 * @param viewScope - Current view scope ('class' or 'teacher')
 * @param viewId - Current view ID (classId or teacherId)
 * @returns Validation result with filtered lessons and warnings
 *
 * @example
 * ```tsx
 * const { isValid, filteredLessons, warnings } = useViewScopeValidation(
 *   enrichedLessons,
 *   'class',
 *   'c1'
 * );
 *
 * if (!isValid) {
 *   warnings.forEach(warning => toast.warning(warning));
 * }
 * ```
 */
export function useViewScopeValidation(
  lessons: EnrichedLesson[],
  viewScope: 'class' | 'teacher',
  viewId: string | null
): ViewScopeValidationResult {
  return useMemo(() => {
    const warnings: string[] = [];

    // No viewId - show all lessons (multi-entity view)
    if (!viewId) {
      logger.debug('View scope validation: no viewId, showing all lessons', {
        viewScope,
        totalLessons: lessons.length,
      });
      return { isValid: true, filteredLessons: lessons, warnings };
    }

    // Filter lessons based on view scope
    const filteredLessons = lessons.filter((lesson) => {
      if (viewScope === 'class') {
        return lesson.classId === viewId;
      } else {
        // Teacher view - check if teacher is assigned to lesson
        return lesson.teacherIds.includes(viewId);
      }
    });

    // Validation checks
    if (filteredLessons.length === 0) {
      const warningMessage =
        viewScope === 'class'
          ? `هیچ درسی برای صنف ${viewId} یافت نشد`
          : `هیچ درسی برای استاد ${viewId} یافت نشد`;

      warnings.push(warningMessage);

      logger.warn('View scope validation: no matching lessons', {
        viewScope,
        viewId,
        totalLessons: lessons.length,
      });

      return {
        isValid: false,
        filteredLessons: [],
        warnings,
      };
    }

    // Check for lessons that don't match viewId
    const unmatchedCount = lessons.length - filteredLessons.length;
    if (unmatchedCount > 0 && filteredLessons.length > 0) {
      logger.info('View scope validation: filtered lessons', {
        viewScope,
        viewId,
        matched: filteredLessons.length,
        unmatched: unmatchedCount,
        total: lessons.length,
      });
    }

    // Success
    logger.debug('View scope validation: passed', {
      viewScope,
      viewId,
      filteredCount: filteredLessons.length,
    });

    return {
      isValid: true,
      filteredLessons,
      warnings,
    };
  }, [lessons, viewScope, viewId]);
}

export default useViewScopeValidation;
