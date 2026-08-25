/**
 * useRealtimeWorkload Hook
 *
 * Provides real-time workload updates with optimistic updates and
 * immediate recalculation on assignment changes.
 *
 * Requirements: 8.4, 8.5
 */

import { invalidateAssignmentCaches, QUERY_KEYS } from '@/lib/queryKeys';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { ClassGroup } from '../../classes/types';
import type { Subject } from '../../subjects/types';
import type { Teacher } from '../../teachers/types';
import {
  calculateTeacherWorkload,
  calculateWorkloadWithAssignment,
  calculateWorkloadWithoutAssignment,
} from '../services/workloadCalculation';
import type { TeacherWorkload, WorkloadStatus } from '../types';

/**
 * Query keys for cache management - re-exported from centralized location
 */
export { QUERY_KEYS };

/**
 * Options for the useRealtimeWorkload hook
 */
export interface UseRealtimeWorkloadOptions {
  /** Enable optimistic updates for better UX */
  enableOptimisticUpdates?: boolean;
  /** Callback when workload status changes */
  onWorkloadStatusChange?: (teacherId: number, status: WorkloadStatus) => void;
  /** Callback when workload exceeds maximum */
  onWorkloadExceeded?: (teacherId: number, totalPeriods: number, maxPeriods: number) => void;
}

/**
 * Result of the useRealtimeWorkload hook
 */
export interface UseRealtimeWorkloadResult {
  /** Calculate workload for a teacher */
  calculateWorkload: (teacher: Teacher) => TeacherWorkload;
  /** Preview workload after adding an assignment */
  previewWorkloadWithAssignment: (
    teacher: Teacher,
    subjectId: number,
    classIds: number[]
  ) => TeacherWorkload;
  /** Preview workload after removing an assignment */
  previewWorkloadWithoutAssignment: (
    teacher: Teacher,
    subjectId: number,
    classIds: number[]
  ) => TeacherWorkload;
  /** Invalidate workload caches to trigger refresh */
  invalidateWorkloadCaches: () => void;
  /** Apply optimistic workload update */
  applyOptimisticUpdate: (teacherId: number, newWorkload: TeacherWorkload) => void;
  /** Revert optimistic update on error */
  revertOptimisticUpdate: (teacherId: number) => void;
  /** Get cached subjects */
  getCachedSubjects: () => Subject[];
  /** Get cached classes */
  getCachedClasses: () => ClassGroup[];
}

/**
 * Hook for real-time workload updates with optimistic updates
 *
 * Provides immediate workload recalculation on assignment changes
 * and updates all workload indicators across components.
 *
 * @param options - Configuration options
 * @returns Workload calculation and update functions
 */
export function useRealtimeWorkload(
  options: UseRealtimeWorkloadOptions = {}
): UseRealtimeWorkloadResult {
  const { onWorkloadStatusChange, onWorkloadExceeded } = options;

  const queryClient = useQueryClient();

  /**
   * Get cached subjects from query cache
   */
  const getCachedSubjects = useCallback((): Subject[] => {
    const cached = queryClient.getQueryData<Subject[]>(QUERY_KEYS.subjects);
    return cached?.filter((s) => !s.isDeleted) ?? [];
  }, [queryClient]);

  /**
   * Get cached classes from query cache
   */
  const getCachedClasses = useCallback((): ClassGroup[] => {
    const cached = queryClient.getQueryData<ClassGroup[]>(QUERY_KEYS.classes);
    return cached?.filter((c) => !c.isDeleted) ?? [];
  }, [queryClient]);

  /**
   * Calculate workload for a teacher using cached data
   */
  const calculateWorkload = useCallback(
    (teacher: Teacher): TeacherWorkload => {
      const subjects = getCachedSubjects();
      const classes = getCachedClasses();
      const workload = calculateTeacherWorkload(teacher, subjects, classes);

      // Trigger callbacks if needed
      if (onWorkloadStatusChange) {
        onWorkloadStatusChange(teacher.id, workload.status);
      }

      if (onWorkloadExceeded && workload.totalPeriods > workload.maxPeriods) {
        onWorkloadExceeded(teacher.id, workload.totalPeriods, workload.maxPeriods);
      }

      return workload;
    },
    [getCachedSubjects, getCachedClasses, onWorkloadStatusChange, onWorkloadExceeded]
  );

  /**
   * Preview workload after adding an assignment
   */
  const previewWorkloadWithAssignment = useCallback(
    (teacher: Teacher, subjectId: number, classIds: number[]): TeacherWorkload => {
      const subjects = getCachedSubjects();
      const classes = getCachedClasses();
      return calculateWorkloadWithAssignment(teacher, subjectId, classIds, subjects, classes);
    },
    [getCachedSubjects, getCachedClasses]
  );

  /**
   * Preview workload after removing an assignment
   */
  const previewWorkloadWithoutAssignment = useCallback(
    (teacher: Teacher, subjectId: number, classIds: number[]): TeacherWorkload => {
      const subjects = getCachedSubjects();
      const classes = getCachedClasses();
      return calculateWorkloadWithoutAssignment(teacher, subjectId, classIds, subjects, classes);
    },
    [getCachedSubjects, getCachedClasses]
  );

  /**
   * Invalidate all workload-related caches to trigger refresh
   */
  const invalidateWorkloadCaches = useCallback(() => {
    invalidateAssignmentCaches(queryClient);
  }, [queryClient]);

  /**
   * Apply optimistic update to teacher workload
   */
  const applyOptimisticUpdate = useCallback(
    (teacherId: number, newWorkload: TeacherWorkload) => {
      // Update the teacher in cache with new workload data
      queryClient.setQueryData<Teacher[]>(QUERY_KEYS.teachers, (oldTeachers) => {
        if (!oldTeachers) return oldTeachers;

        return oldTeachers.map((teacher) => {
          if (teacher.id !== teacherId) return teacher;

          // Store the workload in a meta field for UI components to use
          return {
            ...teacher,
            _cachedWorkload: newWorkload,
          } as Teacher & { _cachedWorkload: TeacherWorkload };
        });
      });

      // Trigger status change callback
      if (onWorkloadStatusChange) {
        onWorkloadStatusChange(teacherId, newWorkload.status);
      }

      // Trigger exceeded callback if needed
      if (onWorkloadExceeded && newWorkload.totalPeriods > newWorkload.maxPeriods) {
        onWorkloadExceeded(teacherId, newWorkload.totalPeriods, newWorkload.maxPeriods);
      }
    },
    [queryClient, onWorkloadStatusChange, onWorkloadExceeded]
  );

  /**
   * Revert optimistic update on error
   */
  const revertOptimisticUpdate = useCallback(
    (teacherId: number) => {
      // Remove the cached workload and refetch
      queryClient.setQueryData<Teacher[]>(QUERY_KEYS.teachers, (oldTeachers) => {
        if (!oldTeachers) return oldTeachers;

        return oldTeachers.map((teacher) => {
          if (teacher.id !== teacherId) return teacher;

          // Remove the cached workload
          const { _cachedWorkload, ...rest } = teacher as Teacher & {
            _cachedWorkload?: TeacherWorkload;
          };
          return rest as Teacher;
        });
      });

      // Invalidate to refetch fresh data
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.teachers });
    },
    [queryClient]
  );

  return useMemo(
    () => ({
      calculateWorkload,
      previewWorkloadWithAssignment,
      previewWorkloadWithoutAssignment,
      invalidateWorkloadCaches,
      applyOptimisticUpdate,
      revertOptimisticUpdate,
      getCachedSubjects,
      getCachedClasses,
    }),
    [
      calculateWorkload,
      previewWorkloadWithAssignment,
      previewWorkloadWithoutAssignment,
      invalidateWorkloadCaches,
      applyOptimisticUpdate,
      revertOptimisticUpdate,
      getCachedSubjects,
      getCachedClasses,
    ]
  );
}

export default useRealtimeWorkload;
