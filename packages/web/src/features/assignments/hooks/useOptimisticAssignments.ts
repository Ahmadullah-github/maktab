/**
 * useOptimisticAssignments Hook
 *
 * Provides optimistic update capabilities for assignment operations.
 * Enables immediate UI feedback while API calls are in progress.
 *
 * Requirements: 11.6
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';
import type { ClassGroup, SubjectRequirement } from '../../classes/types';
import type { ClassAssignment, Teacher } from '../../teachers/types';
import {
  ASSIGNMENT_QUERY_KEYS,
  AssignmentCacheManager,
  createAssignmentCacheManager,
} from '../services/cacheManager';
import type { TeacherWorkload } from '../types';

/**
 * Safely parse JSON array from string or return as-is if already an array
 */
function parseJsonArray<T>(value: string | T[] | null | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Ensure subjectRequirements is always an array
 */
function ensureSubjectRequirements(
  requirements: SubjectRequirement[] | string | null | undefined
): SubjectRequirement[] {
  return parseJsonArray<SubjectRequirement>(requirements);
}

/**
 * Snapshot of data before optimistic update for rollback
 */
interface OptimisticSnapshot {
  teachers?: Teacher[];
  classes?: ClassGroup[];
  workloads?: Map<number, TeacherWorkload>;
  timestamp: number;
}

/**
 * Options for optimistic assignment operations
 */
export interface OptimisticAssignmentOptions {
  /** Whether to automatically rollback on error */
  autoRollback?: boolean;
  /** Callback when optimistic update is applied */
  onOptimisticUpdate?: () => void;
  /** Callback when rollback occurs */
  onRollback?: () => void;
}

/**
 * Result of the useOptimisticAssignments hook
 */
export interface UseOptimisticAssignmentsResult {
  /** Cache manager instance */
  cacheManager: AssignmentCacheManager;

  /** Apply optimistic teacher assignment update */
  optimisticAddAssignment: (
    teacherId: number,
    assignment: ClassAssignment
  ) => OptimisticSnapshot | null;

  /** Apply optimistic teacher assignment removal */
  optimisticRemoveAssignment: (teacherId: number, subjectId: number) => OptimisticSnapshot | null;

  /** Apply optimistic class teacher assignment */
  optimisticAssignTeacherToClass: (
    classId: number,
    subjectId: number,
    teacherId: number
  ) => OptimisticSnapshot | null;

  /** Rollback to a previous snapshot */
  rollback: (snapshot: OptimisticSnapshot) => void;

  /** Commit optimistic update (clear snapshot) */
  commit: () => void;

  /** Check if there's a pending optimistic update */
  hasPendingUpdate: boolean;
}

/**
 * Hook for managing optimistic updates in assignment operations
 */
export function useOptimisticAssignments(
  options: OptimisticAssignmentOptions = {}
): UseOptimisticAssignmentsResult {
  const { onOptimisticUpdate, onRollback } = options;

  const queryClient = useQueryClient();
  const cacheManager = useMemo(() => createAssignmentCacheManager(queryClient), [queryClient]);

  // Track pending snapshots for rollback
  const pendingSnapshot = useRef<OptimisticSnapshot | null>(null);

  /**
   * Create a snapshot of current state for rollback
   */
  const createSnapshot = useCallback((): OptimisticSnapshot => {
    const teachers = queryClient.getQueryData<Teacher[]>(ASSIGNMENT_QUERY_KEYS.teachers);
    const classes = queryClient.getQueryData<ClassGroup[]>(ASSIGNMENT_QUERY_KEYS.classes);

    return {
      teachers: teachers ? [...teachers] : undefined,
      classes: classes ? [...classes] : undefined,
      workloads: new Map(),
      timestamp: Date.now(),
    };
  }, [queryClient]);

  /**
   * Apply optimistic update for adding an assignment to a teacher
   */
  const optimisticAddAssignment = useCallback(
    (teacherId: number, assignment: ClassAssignment): OptimisticSnapshot | null => {
      const snapshot = createSnapshot();
      pendingSnapshot.current = snapshot;

      const updated = cacheManager.applyOptimisticTeacherUpdate(teacherId, (teacher) => {
        // Ensure classAssignments is an array
        const currentAssignments = Array.isArray(teacher.classAssignments)
          ? teacher.classAssignments
          : [];

        // Check if assignment for this subject already exists
        const existingIndex = currentAssignments.findIndex(
          (a) => a.subjectId === assignment.subjectId
        );

        let newAssignments: ClassAssignment[];

        if (existingIndex >= 0) {
          // Merge with existing assignment
          newAssignments = currentAssignments.map((a, index) => {
            if (index !== existingIndex) return a;
            const existingClassIds = Array.isArray(a.classIds) ? a.classIds : [];
            const newClassIds = Array.isArray(assignment.classIds) ? assignment.classIds : [];
            const mergedClassIds = [...new Set([...existingClassIds, ...newClassIds])];
            return { ...a, classIds: mergedClassIds };
          });
        } else {
          // Add new assignment
          newAssignments = [...currentAssignments, assignment];
        }

        return { ...teacher, classAssignments: newAssignments };
      });

      if (updated) {
        // Invalidate computed caches
        cacheManager.invalidateComputedCaches();
        onOptimisticUpdate?.();
      }

      return updated ? snapshot : null;
    },
    [cacheManager, createSnapshot, onOptimisticUpdate]
  );

  /**
   * Apply optimistic update for removing an assignment from a teacher
   */
  const optimisticRemoveAssignment = useCallback(
    (teacherId: number, subjectId: number): OptimisticSnapshot | null => {
      const snapshot = createSnapshot();
      pendingSnapshot.current = snapshot;

      const updated = cacheManager.applyOptimisticTeacherUpdate(teacherId, (teacher) => {
        // Ensure classAssignments is an array
        const currentAssignments = Array.isArray(teacher.classAssignments)
          ? teacher.classAssignments
          : [];
        const newAssignments = currentAssignments.filter((a) => a.subjectId !== subjectId);
        return { ...teacher, classAssignments: newAssignments };
      });

      if (updated) {
        cacheManager.invalidateComputedCaches();
        onOptimisticUpdate?.();
      }

      return updated ? snapshot : null;
    },
    [cacheManager, createSnapshot, onOptimisticUpdate]
  );

  /**
   * Apply optimistic update for assigning a teacher to a class subject
   */
  const optimisticAssignTeacherToClass = useCallback(
    (classId: number, subjectId: number, teacherId: number): OptimisticSnapshot | null => {
      const snapshot = createSnapshot();
      pendingSnapshot.current = snapshot;

      // Update the class's subject requirements
      const updatedClass = cacheManager.applyOptimisticClassUpdate(classId, (classGroup) => {
        // Ensure subjectRequirements is an array (handles JSON string from API)
        const requirements = ensureSubjectRequirements(classGroup.subjectRequirements);
        const newRequirements = requirements.map((req) => {
          if (req.subjectId !== subjectId) return req;
          return { ...req, teacherId };
        });
        return { ...classGroup, subjectRequirements: newRequirements };
      });

      // Also update the teacher's assignments
      const teacher = cacheManager.getCachedTeacher(teacherId);
      if (teacher) {
        const cachedClass = cacheManager.getCachedClass(classId);
        // getCachedClass already ensures subjectRequirements is parsed
        const classReq = cachedClass?.subjectRequirements.find((r) => r.subjectId === subjectId);

        if (classReq) {
          cacheManager.applyOptimisticTeacherUpdate(teacherId, (t) => {
            // Ensure classAssignments is an array
            const currentAssignments = Array.isArray(t.classAssignments) ? t.classAssignments : [];
            const existingIndex = currentAssignments.findIndex((a) => a.subjectId === subjectId);

            let newAssignments: ClassAssignment[];

            if (existingIndex >= 0) {
              // Add class to existing assignment
              newAssignments = currentAssignments.map((a, index) => {
                if (index !== existingIndex) return a;
                const existingClassIds = Array.isArray(a.classIds) ? a.classIds : [];
                if (existingClassIds.includes(classId)) return a;
                return { ...a, classIds: [...existingClassIds, classId] };
              });
            } else {
              // Create new assignment
              newAssignments = [...currentAssignments, { subjectId, classIds: [classId] }];
            }

            return { ...t, classAssignments: newAssignments };
          });
        }
      }

      if (updatedClass) {
        cacheManager.invalidateComputedCaches();
        onOptimisticUpdate?.();
      }

      return updatedClass ? snapshot : null;
    },
    [cacheManager, createSnapshot, onOptimisticUpdate]
  );

  /**
   * Rollback to a previous snapshot
   */
  const rollback = useCallback(
    (snapshot: OptimisticSnapshot) => {
      if (snapshot.teachers) {
        queryClient.setQueryData(ASSIGNMENT_QUERY_KEYS.teachers, snapshot.teachers);
      }
      if (snapshot.classes) {
        queryClient.setQueryData(ASSIGNMENT_QUERY_KEYS.classes, snapshot.classes);
      }

      pendingSnapshot.current = null;
      cacheManager.invalidateComputedCaches();
      onRollback?.();
    },
    [queryClient, cacheManager, onRollback]
  );

  /**
   * Commit optimistic update (clear pending snapshot)
   */
  const commit = useCallback(() => {
    pendingSnapshot.current = null;
  }, []);

  return useMemo(
    () => ({
      cacheManager,
      optimisticAddAssignment,
      optimisticRemoveAssignment,
      optimisticAssignTeacherToClass,
      rollback,
      commit,
      hasPendingUpdate: pendingSnapshot.current !== null,
    }),
    [
      cacheManager,
      optimisticAddAssignment,
      optimisticRemoveAssignment,
      optimisticAssignTeacherToClass,
      rollback,
      commit,
    ]
  );
}

export default useOptimisticAssignments;
