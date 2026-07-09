/**
 * useTeacherAssignments Hook
 *
 * Provides CRUD operations for teacher class assignments with
 * TanStack Query integration, cache invalidation, and optimistic updates.
 *
 * Requirements: 1.6, 8.4, 8.5
 */

import { invalidateAssignmentCaches, QUERY_KEYS } from '@/lib/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { assignmentsApi } from '../../assignments/hooks/useAssignmentMutations';
import { teacherAssignmentKeys } from '../../teacher-assignments/hooks';
import type { ClassGroup, SubjectRequirement } from '../../classes/types';
import type { ClassAssignment, Teacher } from '../types';
import { logger } from '../utils/logger';

/**
 * Options for the useTeacherAssignments hook
 */
export interface UseTeacherAssignmentsOptions {
  /** Enable optimistic updates for better UX */
  enableOptimisticUpdates?: boolean;
  /** Callback when assignment changes */
  onAssignmentChange?: (teacherId: number, assignments: ClassAssignment[]) => void;
}

/**
 * Hook for managing teacher class assignments
 *
 * Provides functions to add, remove, and update assignments
 * with automatic cache invalidation, toast notifications,
 * and optimistic updates for real-time UI synchronization.
 *
 * @param options - Configuration options
 * @returns Object with assignment mutation functions
 */
export function useTeacherAssignments(options: UseTeacherAssignmentsOptions = {}) {
  const { enableOptimisticUpdates = true, onAssignmentChange } = options;
  const queryClient = useQueryClient();

  /**
   * Invalidate all related caches for cross-feature consistency
   * using centralized invalidation function
   */
  const invalidateCaches = () => {
    invalidateAssignmentCaches(queryClient);
  };

  /**
   * Apply optimistic update to teacher in cache
   */
  const applyOptimisticUpdate = (teacherId: number, updatedAssignments: ClassAssignment[]) => {
    if (!enableOptimisticUpdates) return;

    // Trigger callback for real-time sync
    if (onAssignmentChange) {
      onAssignmentChange(teacherId, updatedAssignments);
    }
  };

  /**
   * Revert optimistic update on error
   */
  const revertOptimisticUpdate = (teacherId: number, previousAssignments: ClassAssignment[]) => {
    if (!enableOptimisticUpdates) return;

    if (onAssignmentChange) {
      onAssignmentChange(teacherId, previousAssignments);
    }
  };

  const getCachedClasses = (): ClassGroup[] => {
    return queryClient.getQueryData<ClassGroup[]>(QUERY_KEYS.classes) ?? [];
  };

  const getCachedTeacherAssignmentClassIds = (teacherId: number, subjectId: number): number[] => {
    const cachedAssignments =
      queryClient.getQueryData<
        Array<{
          teacherId: number;
          classId: number;
          subjectId: number;
        }>
      >(teacherAssignmentKeys.lists()) ?? [];

    return Array.from(
      new Set(
        cachedAssignments
          .filter((assignment) => assignment.teacherId === teacherId && assignment.subjectId === subjectId)
          .map((assignment) => assignment.classId)
      )
    );
  };

  const getRequiredPeriods = (subjectId: number, classId: number): number => {
    const classData = getCachedClasses().find((item) => item.id === classId);
    const subjectRequirements = Array.isArray(classData?.subjectRequirements)
      ? classData.subjectRequirements
      : [];
    const requirement = subjectRequirements.find(
      (candidate: SubjectRequirement) => candidate.subjectId === subjectId
    );

    return requirement?.periodsPerWeek ?? 1;
  };

  const buildClassPeriodOverrides = (subjectId: number, classIds: number[]) => {
    return classIds.map((classId) => ({
      classId,
      periodsPerWeek: getRequiredPeriods(subjectId, classId),
    }));
  };

  /**
   * Add a new assignment to a teacher
   */
  const addAssignment = useMutation({
    mutationFn: async ({
      teacherId,
      teacher,
      assignment,
    }: {
      teacherId: number;
      teacher: Teacher;
      assignment: ClassAssignment;
    }) => {
      // Ensure classAssignments is an array
      const currentAssignments = Array.isArray(teacher.classAssignments)
        ? teacher.classAssignments
        : [];

      // Check if assignment for this subject already exists
      const existingIndex = currentAssignments.findIndex(
        (a) => a.subjectId === assignment.subjectId
      );

      let updatedAssignments: ClassAssignment[];

      if (existingIndex >= 0) {
        // Merge with existing assignment
        updatedAssignments = currentAssignments.map((a, index) => {
          if (index !== existingIndex) return a;
          const existingClassIds = Array.isArray(a.classIds) ? a.classIds : [];
          const newClassIds = Array.isArray(assignment.classIds) ? assignment.classIds : [];
          const mergedClassIds = [...new Set([...existingClassIds, ...newClassIds])];
          return { ...a, classIds: mergedClassIds };
        });
      } else {
        // Add new assignment
        updatedAssignments = [...currentAssignments, assignment];
      }

      // Apply optimistic update immediately
      applyOptimisticUpdate(teacherId, updatedAssignments);

      return assignmentsApi.assign({
        teacherId,
        subjectId: assignment.subjectId,
        classIds: assignment.classIds,
        classPeriodOverrides: buildClassPeriodOverrides(assignment.subjectId, assignment.classIds),
        persistRequirementOverrides: true,
      });
    },
    onSuccess: () => {
      logger.debug('Assignment added successfully');
      invalidateCaches();
      toast.success('تخصیص با موفقیت انجام شد', {
        description: 'صنف‌ها به معلم تخصیص یافتند',
      });
    },
    onError: (error: Error, variables) => {
      logger.error('Failed to add assignment', { error: error.message });
      // Revert optimistic update
      revertOptimisticUpdate(variables.teacherId, variables.teacher.classAssignments);
      toast.error('خطا در تخصیص', {
        description: error.message,
      });
    },
  });

  /**
   * Remove an entire assignment (all classes for a subject)
   */
  const removeAssignment = useMutation({
    mutationFn: async ({
      teacherId,
      teacher,
      subjectId,
    }: {
      teacherId: number;
      teacher: Teacher;
      subjectId: number;
    }) => {
      // Ensure classAssignments is an array
      const currentAssignments = Array.isArray(teacher.classAssignments)
        ? teacher.classAssignments
        : [];
      const updatedAssignments = currentAssignments.filter((a) => a.subjectId !== subjectId);
      const classIds =
        getCachedTeacherAssignmentClassIds(teacherId, subjectId) ||
        currentAssignments.find((assignment) => assignment.subjectId === subjectId)?.classIds ||
        [];

      // Apply optimistic update immediately
      applyOptimisticUpdate(teacherId, updatedAssignments);

      if (classIds.length === 0) {
        return { success: true };
      }

      return assignmentsApi.unassign({
        teacherId,
        subjectId,
        classIds,
      });
    },
    onSuccess: () => {
      logger.debug('Assignment removed successfully');
      invalidateCaches();
      toast.success('تخصیص با موفقیت حذف شد');
    },
    onError: (error: Error, variables) => {
      logger.error('Failed to remove assignment', { error: error.message });
      // Revert optimistic update
      revertOptimisticUpdate(variables.teacherId, variables.teacher.classAssignments);
      toast.error('خطا در حذف تخصیص', {
        description: error.message,
      });
    },
  });

  /**
   * Remove specific classes from an assignment
   */
  const removeClassesFromAssignment = useMutation({
    mutationFn: async ({
      teacherId,
      teacher,
      subjectId,
      classIds,
    }: {
      teacherId: number;
      teacher: Teacher;
      subjectId: number;
      classIds: number[];
    }) => {
      // Ensure classAssignments is an array
      const currentAssignments = Array.isArray(teacher.classAssignments)
        ? teacher.classAssignments
        : [];
      const updatedAssignments = currentAssignments
        .map((a) => {
          if (a.subjectId !== subjectId) return a;
          const existingClassIds = Array.isArray(a.classIds) ? a.classIds : [];
          const remainingClassIds = existingClassIds.filter((id) => !classIds.includes(id));
          if (remainingClassIds.length === 0) return null;
          return { ...a, classIds: remainingClassIds };
        })
        .filter((a): a is ClassAssignment => a !== null);

      // Apply optimistic update immediately
      applyOptimisticUpdate(teacherId, updatedAssignments);

      return assignmentsApi.unassign({
        teacherId,
        subjectId,
        classIds,
      });
    },
    onSuccess: () => {
      logger.debug('Classes removed from assignment successfully');
      invalidateCaches();
      toast.success('صنف‌ها از تخصیص حذف شدند');
    },
    onError: (error: Error, variables) => {
      logger.error('Failed to remove classes from assignment', { error: error.message });
      // Revert optimistic update
      revertOptimisticUpdate(variables.teacherId, variables.teacher.classAssignments);
      toast.error('خطا در حذف صنف‌ها', {
        description: error.message,
      });
    },
  });

  /**
   * Add classes to an existing assignment
   */
  const addClassesToAssignment = useMutation({
    mutationFn: async ({
      teacherId,
      teacher,
      subjectId,
      classIds,
    }: {
      teacherId: number;
      teacher: Teacher;
      subjectId: number;
      classIds: number[];
    }) => {
      // Ensure classAssignments is an array
      const currentAssignments = Array.isArray(teacher.classAssignments)
        ? teacher.classAssignments
        : [];
      const updatedAssignments = currentAssignments.map((a) => {
        if (a.subjectId !== subjectId) return a;
        const existingClassIds = Array.isArray(a.classIds) ? a.classIds : [];
        const mergedClassIds = [...new Set([...existingClassIds, ...classIds])];
        return { ...a, classIds: mergedClassIds };
      });

      // Apply optimistic update immediately
      applyOptimisticUpdate(teacherId, updatedAssignments);

      return assignmentsApi.assign({
        teacherId,
        subjectId,
        classIds,
        classPeriodOverrides: buildClassPeriodOverrides(subjectId, classIds),
        persistRequirementOverrides: true,
      });
    },
    onSuccess: () => {
      logger.debug('Classes added to assignment successfully');
      invalidateCaches();
      toast.success('صنف‌ها به تخصیص اضافه شدند');
    },
    onError: (error: Error, variables) => {
      logger.error('Failed to add classes to assignment', { error: error.message });
      // Revert optimistic update
      revertOptimisticUpdate(variables.teacherId, variables.teacher.classAssignments);
      toast.error('خطا در افزودن صنف‌ها', {
        description: error.message,
      });
    },
  });

  /**
   * Update all assignments for a teacher (bulk update)
   */
  const updateAssignments = useMutation({
    mutationFn: async ({
      teacherId,
      assignments,
      previousAssignments,
    }: {
      teacherId: number;
      assignments: ClassAssignment[];
      previousAssignments?: ClassAssignment[];
    }) => {
      // Apply optimistic update immediately
      applyOptimisticUpdate(teacherId, assignments);

      const previousMap = new Map<number, number[]>(
        (previousAssignments ?? []).map((assignment) => [assignment.subjectId, assignment.classIds])
      );
      const nextMap = new Map<number, number[]>(
        assignments.map((assignment) => [assignment.subjectId, assignment.classIds])
      );
      const subjectIds = new Set([...previousMap.keys(), ...nextMap.keys()]);

      for (const subjectId of subjectIds) {
        const previousClassIds = previousMap.get(subjectId) ?? [];
        const nextClassIds = nextMap.get(subjectId) ?? [];
        const classIdsToRemove = previousClassIds.filter((classId) => !nextClassIds.includes(classId));
        const classIdsToAdd = nextClassIds.filter((classId) => !previousClassIds.includes(classId));

        if (classIdsToRemove.length > 0) {
          await assignmentsApi.unassign({
            teacherId,
            subjectId,
            classIds: classIdsToRemove,
          });
        }

        if (classIdsToAdd.length > 0) {
          await assignmentsApi.assign({
            teacherId,
            subjectId,
            classIds: classIdsToAdd,
            classPeriodOverrides: buildClassPeriodOverrides(subjectId, classIdsToAdd),
            persistRequirementOverrides: true,
          });
        }
      }

      return { success: true };
    },
    onSuccess: () => {
      logger.debug('Assignments updated successfully');
      invalidateCaches();
      toast.success('تخصیص‌ها با موفقیت بروزرسانی شدند');
    },
    onError: (error: Error, variables) => {
      logger.error('Failed to update assignments', { error: error.message });
      // Revert optimistic update if we have previous assignments
      if (variables.previousAssignments) {
        revertOptimisticUpdate(variables.teacherId, variables.previousAssignments);
      }
      toast.error('خطا در بروزرسانی تخصیص‌ها', {
        description: error.message,
      });
    },
  });

  return {
    addAssignment,
    removeAssignment,
    removeClassesFromAssignment,
    addClassesToAssignment,
    updateAssignments,
    isLoading:
      addAssignment.isPending ||
      removeAssignment.isPending ||
      removeClassesFromAssignment.isPending ||
      addClassesToAssignment.isPending ||
      updateAssignments.isPending,
  };
}

export default useTeacherAssignments;
