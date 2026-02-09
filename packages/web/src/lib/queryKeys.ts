/**
 * Centralized Query Keys and Cache Invalidation
 *
 * Single source of truth for all query keys across features.
 * Ensures real-time synchronization when assignments change.
 */

import type { QueryClient } from '@tanstack/react-query';

// ============================================================================
// Query Keys - Single Source of Truth
// ============================================================================

export const QUERY_KEYS = {
  // Core entities
  teachers: ['teachers'] as const,
  classes: ['classes'] as const,
  subjects: ['subjects'] as const,

  // Assignments
  assignments: ['assignments'] as const,
  teacherAssignments: ['teacher-assignments'] as const,

  // Coverage & Workload
  subjectCoverage: ['subject-coverage'] as const,
  teacherWorkload: ['teacher-workload'] as const,

  // Conflicts
  conflicts: ['conflicts'] as const,
} as const;

// ============================================================================
// Invalidation Strategies
// ============================================================================

/**
 * Invalidate all assignment-related caches
 * Use after any assignment operation (assign/unassign teacher)
 */
export function invalidateAssignmentCaches(queryClient: QueryClient): void {
  // Core entities that contain assignment data
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.teachers });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.classes });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.subjects });

  // Assignment-specific caches
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.teacherAssignments });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assignments });

  // Derived data
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.subjectCoverage });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.teacherWorkload });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conflicts });
}

/**
 * Invalidate teacher-related caches
 * Use after teacher CRUD operations
 */
export function invalidateTeacherCaches(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.teachers });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.teacherAssignments });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.teacherWorkload });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.subjectCoverage });
}

/**
 * Invalidate class-related caches
 * Use after class CRUD operations
 */
export function invalidateClassCaches(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.classes });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.teacherAssignments });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.subjectCoverage });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.teacherWorkload });
}

/**
 * Invalidate subject-related caches
 * Use after subject CRUD operations
 */
export function invalidateSubjectCaches(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.subjects });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.teacherAssignments });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.subjectCoverage });
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.classes }); // Classes have subject requirements
}

/**
 * Invalidate ALL caches - nuclear option for major changes
 */
export function invalidateAllCaches(queryClient: QueryClient): void {
  Object.values(QUERY_KEYS).forEach((key) => {
    queryClient.invalidateQueries({ queryKey: key });
  });
}

// ============================================================================
// Re-export for convenience
// ============================================================================

export type QueryKeys = typeof QUERY_KEYS;
