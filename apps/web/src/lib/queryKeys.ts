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
  assignmentMatrix: ['assignment-matrix'] as const,
  classAssignmentViews: ['class-assignment-view'] as const,
  classAssignmentView: (classId: number) => [...QUERY_KEYS.classAssignmentViews, classId] as const,

  // Coverage & Workload
  subjectCoverage: ['subject-coverage'] as const,
  subjectCoverageViews: ['subject-coverage-view'] as const,
  subjectCoverageView: (subjectId: number) =>
    [...QUERY_KEYS.subjectCoverageViews, subjectId] as const,
  teacherWorkload: ['teacher-workload'] as const,
  teacherWorkloadViews: ['teacher-workload-view'] as const,
  teacherWorkloadView: (teacherId: number) =>
    [...QUERY_KEYS.teacherWorkloadViews, teacherId] as const,
  teacherAssignmentSummaries: ['teacher-assignment-summary'] as const,
  teacherAssignmentSummary: (teacherId: number) =>
    [...QUERY_KEYS.teacherAssignmentSummaries, teacherId] as const,

  // Conflicts
  conflicts: ['conflicts'] as const,
} as const;

const ASSIGNMENT_INVALIDATION_KEYS = [
  QUERY_KEYS.teachers,
  QUERY_KEYS.classes,
  QUERY_KEYS.subjects,
  QUERY_KEYS.assignments,
  QUERY_KEYS.teacherAssignments,
  QUERY_KEYS.assignmentMatrix,
  QUERY_KEYS.classAssignmentViews,
  QUERY_KEYS.subjectCoverage,
  QUERY_KEYS.subjectCoverageViews,
  QUERY_KEYS.teacherWorkload,
  QUERY_KEYS.teacherWorkloadViews,
  QUERY_KEYS.teacherAssignmentSummaries,
  QUERY_KEYS.conflicts,
] as const;

const TEACHER_INVALIDATION_KEYS = [
  QUERY_KEYS.teachers,
  QUERY_KEYS.teacherAssignments,
  QUERY_KEYS.teacherWorkload,
  QUERY_KEYS.teacherWorkloadViews,
  QUERY_KEYS.teacherAssignmentSummaries,
  QUERY_KEYS.assignmentMatrix,
  QUERY_KEYS.subjectCoverage,
  QUERY_KEYS.subjectCoverageViews,
  QUERY_KEYS.conflicts,
] as const;

const CLASS_INVALIDATION_KEYS = [
  QUERY_KEYS.classes,
  QUERY_KEYS.teacherAssignments,
  QUERY_KEYS.classAssignmentViews,
  QUERY_KEYS.assignmentMatrix,
  QUERY_KEYS.subjectCoverage,
  QUERY_KEYS.subjectCoverageViews,
  QUERY_KEYS.teacherWorkload,
  QUERY_KEYS.teacherWorkloadViews,
] as const;

const SUBJECT_INVALIDATION_KEYS = [
  QUERY_KEYS.subjects,
  QUERY_KEYS.teacherAssignments,
  QUERY_KEYS.assignmentMatrix,
  QUERY_KEYS.subjectCoverage,
  QUERY_KEYS.subjectCoverageViews,
  QUERY_KEYS.classes,
] as const;

function invalidateKeys(
  queryClient: QueryClient,
  keys: ReadonlyArray<readonly unknown[]>
): void {
  keys.forEach((key) => {
    queryClient.invalidateQueries({ queryKey: key });
  });
}

// ============================================================================
// Invalidation Strategies
// ============================================================================

/**
 * Invalidate all assignment-related caches
 * Use after any assignment operation (assign/unassign teacher)
 */
export function invalidateAssignmentCaches(queryClient: QueryClient): void {
  invalidateKeys(queryClient, ASSIGNMENT_INVALIDATION_KEYS);
}

/**
 * Invalidate teacher-related caches
 * Use after teacher CRUD operations
 */
export function invalidateTeacherCaches(queryClient: QueryClient): void {
  invalidateKeys(queryClient, TEACHER_INVALIDATION_KEYS);
}

/**
 * Invalidate class-related caches
 * Use after class CRUD operations
 */
export function invalidateClassCaches(queryClient: QueryClient): void {
  invalidateKeys(queryClient, CLASS_INVALIDATION_KEYS);
}

/**
 * Invalidate subject-related caches
 * Use after subject CRUD operations
 */
export function invalidateSubjectCaches(queryClient: QueryClient): void {
  invalidateKeys(queryClient, SUBJECT_INVALIDATION_KEYS);
}

/**
 * Invalidate ALL caches - nuclear option for major changes
 */
export function invalidateAllCaches(queryClient: QueryClient): void {
  invalidateKeys(queryClient, ASSIGNMENT_INVALIDATION_KEYS);
}

// ============================================================================
// Re-export for convenience
// ============================================================================

export type QueryKeys = typeof QUERY_KEYS;
